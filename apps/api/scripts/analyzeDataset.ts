#!/usr/bin/env ts-node

/**
 * SAP O2C Dataset Analysis Script
 * Analyzes nested JSONL files and extracts structural insights
 *
 * Run with: pnpm analyze
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface FileInfo {
  filePath: string;
  entity: string;
}

interface NullStat {
  nullCount: number;
  nullPercentage: number;
  category: 'HIGH_NULL' | 'MEDIUM_NULL' | 'LOW_NULL';
}

interface FileAnalysis {
  entity: string;
  fileName: string;
  totalRecords: number;
  totalFields: number;
  fields: string[];
  nullAnalysis: Record<string, NullStat>;
  sampleRecords: Record<string, any>[];
}

interface GlobalSummary {
  totalFilesProcessed: number;
  totalEntities: number;
  topFields: Array<{ field: string; frequency: number }>;
  crossEntityFields: Array<{ field: string; entities: string[]; frequency: number }>;
}

// ============================================================================
// GLOBALS
// ============================================================================

const DATA_DIR = './data/sap-o2c-data';
const fieldFrequencyMap = new Map<string, Set<string>>();
const results: FileAnalysis[] = [];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Recursively discover all .jsonl files in directory
 */
async function getAllJsonlFiles(_dir: string): Promise<FileInfo[]> {
  const files: FileInfo[] = [];

  async function traverse(currentPath: string, parentDir: string) {
    if (!fs.existsSync(currentPath)) {
      console.warn(`⚠ Path does not exist: ${currentPath}`);
      return;
    }

    const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        // Recurse into subdirectories
        await traverse(fullPath, entry.name);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        files.push({
          filePath: fullPath,
          entity: parentDir,
        });
      }
    }
  }

  // Start traversal from root data directory
  const rootEntries = await fs.promises.readdir(DATA_DIR, {
    withFileTypes: true,
  });

  for (const entry of rootEntries) {
    if (entry.isDirectory()) {
      const entityPath = path.join(DATA_DIR, entry.name);
      await traverse(entityPath, entry.name);
    }
  }

  return files;
}

/**
 * Parse a single JSON line safely
 */
function parseJsonLine(line: string): Record<string, any> | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

/**
 * Analyze a single JSONL file using stream processing
 */
async function analyzeFile(filePath: string, entity: string): Promise<FileAnalysis> {
  const fileName = path.basename(filePath);
  const fieldsSet = new Set<string>();
  const nullCounts = new Map<string, number>();
  const sampleRecords: Record<string, any>[] = [];
  let totalRecords = 0;
  let lineNumber = 0;

  return new Promise<FileAnalysis>((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({ input: stream });

    rl.on('line', (line: string) => {
      lineNumber++;

      // Skip empty lines
      if (!line.trim()) {
        return;
      }

      // Parse JSON safely
      const record = parseJsonLine(line);
      if (!record) {
        console.warn(
          `⚠ Invalid JSON in ${entity}/${fileName} at line ${lineNumber}`
        );
        return;
      }

      totalRecords++;

      // Extract fields and track nulls
      for (const [field, value] of Object.entries(record)) {
        fieldsSet.add(field);

        // Track null/empty values
        if (value === null || value === '') {
          nullCounts.set(field, (nullCounts.get(field) ?? 0) + 1);
        }
      }

      // Store first 3 valid records as samples
      if (sampleRecords.length < 3) {
        sampleRecords.push(record);
      }
    });

    rl.on('close', () => {
      // Compute null statistics
      const nullAnalysis: Record<string, NullStat> = {};

      for (const field of fieldsSet) {
        const nullCount = nullCounts.get(field) ?? 0;
        const nullPercentage = totalRecords > 0 
          ? parseFloat(((nullCount / totalRecords) * 100).toFixed(1))
          : 0;

        let category: 'HIGH_NULL' | 'MEDIUM_NULL' | 'LOW_NULL';
        if (nullPercentage > 70) {
          category = 'HIGH_NULL';
        } else if (nullPercentage >= 30) {
          category = 'MEDIUM_NULL';
        } else {
          category = 'LOW_NULL';
        }

        nullAnalysis[field] = {
          nullCount,
          nullPercentage,
          category,
        };
      }

      // Update global field frequency
      for (const field of fieldsSet) {
        if (!fieldFrequencyMap.has(field)) {
          fieldFrequencyMap.set(field, new Set());
        }
        fieldFrequencyMap.get(field)!.add(entity);
      }

      const analysis: FileAnalysis = {
        entity,
        fileName,
        totalRecords,
        totalFields: fieldsSet.size,
        fields: Array.from(fieldsSet).sort(),
        nullAnalysis,
        sampleRecords,
      };

      resolve(analysis);
    });

    rl.on('error', reject);
    stream.on('error', reject);
  });
}

/**
 * Compute global summary statistics
 */
function computeGlobalSummary(): GlobalSummary {
  const entities = new Set<string>();
  results.forEach((r) => entities.add(r.entity));

  // Build field frequency list
  const fieldFrequencyList: Array<{ field: string; frequency: number }> = [];
  for (const [field, entitySet] of fieldFrequencyMap) {
    fieldFrequencyList.push({
      field,
      frequency: results.filter((r) =>
        r.fields.includes(field)
      ).length,
    });
  }

  // Sort by frequency descending
  fieldFrequencyList.sort((a, b) => b.frequency - a.frequency);

  // Find fields appearing in multiple entities
  const crossEntityFields: Array<{ field: string; entities: string[]; frequency: number }> =
    [];
  for (const [field, entitySet] of fieldFrequencyMap) {
    if (entitySet.size > 1) {
      crossEntityFields.push({
        field,
        entities: Array.from(entitySet).sort(),
        frequency: results.filter((r) => r.fields.includes(field)).length,
      });
    }
  }

  // Sort by frequency descending
  crossEntityFields.sort((a, b) => b.frequency - a.frequency);

  return {
    totalFilesProcessed: results.length,
    totalEntities: entities.size,
    topFields: fieldFrequencyList.slice(0, 15),
    crossEntityFields,
  };
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🔍 Starting SAP O2C Dataset Analysis...\n');

  // Step 1: Discover all JSONL files
  console.log(`📂 Discovering JSONL files in ${DATA_DIR}...`);
  const files = await getAllJsonlFiles(DATA_DIR);
  console.log(`✓ Found ${files.length} files\n`);

  if (files.length === 0) {
    console.warn(`⚠ No JSONL files found in ${DATA_DIR}`);
    console.log(
      '\nMake sure dataset exists at: ' + path.resolve(DATA_DIR)
    );
    // @ts-ignore - process is global in Node.js
    process.exit(0);
  }

  // Step 2: Analyze each file
  console.log('📊 Analyzing files...\n');
  for (let i = 0; i < files.length; i++) {
    const { filePath, entity } = files[i];
    const fileName = path.basename(filePath);

    try {
      console.log(
        `⏳ [${i + 1}/${files.length}] ${entity}/${fileName}`
      );
      const analysis = await analyzeFile(filePath, entity);
      results.push(analysis);

      // Print per-file result
      console.log(JSON.stringify(analysis, null, 2));
      console.log('\n' + '='.repeat(80) + '\n');
    } catch (error) {
      console.error(
        `✗ Error analyzing ${entity}/${fileName}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // Step 3: Compute and print global summary
  console.log('📈 GLOBAL SUMMARY\n');
  const summary = computeGlobalSummary();
  console.log(JSON.stringify(summary, null, 2));

  console.log('\n✓ Analysis complete!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  // @ts-ignore - process is global in Node.js
  process.exit(1);
});
