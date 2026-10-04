/**
 * ValidationCycle is deterministic lifecycle structure:
 *
 * exact ten countable terminal ResearchBlocks
 *   -> fresh Validator
 *   -> durable ValidationReport
 *   -> Director MUST review the report
 *   -> next ResearchBlock may begin
 *
 * This file remains a placeholder until BioLab lifecycle stores exist.
 */
export const VALIDATION_BLOCK_INTERVAL = 10 as const
