import { ContextRepository } from '../../domain/interfaces.js';
import {
  DEFAULT_OUTPUT_FORMAT,
  OUTPUT_FORMATS,
  OutputFormat,
} from '../../domain/entities.js';

export class PreferencesService {
  constructor(private readonly contextRepository: ContextRepository) {}

  async getOutputFormat(): Promise<OutputFormat> {
    const ctx = await this.contextRepository.getContext();
    const stored = ctx.preferences?.outputFormat;
    if (stored && (OUTPUT_FORMATS as readonly string[]).includes(stored)) {
      return stored as OutputFormat;
    }
    return DEFAULT_OUTPUT_FORMAT;
  }

  async setOutputFormat(format: string): Promise<OutputFormat> {
    if (!(OUTPUT_FORMATS as readonly string[]).includes(format)) {
      throw new Error(
        `Invalid output format '${format}'. Valid options: ${OUTPUT_FORMATS.join(', ')}.`,
      );
    }
    const ctx = await this.contextRepository.getContext();
    ctx.preferences = { ...(ctx.preferences || {}), outputFormat: format as OutputFormat };
    await this.contextRepository.saveContext(ctx);
    return format as OutputFormat;
  }

  async resetOutputFormat(): Promise<void> {
    const ctx = await this.contextRepository.getContext();
    if (ctx.preferences && 'outputFormat' in ctx.preferences) {
      const rest = { ...ctx.preferences };
      delete rest.outputFormat;
      ctx.preferences = rest;
      await this.contextRepository.saveContext(ctx);
    }
  }
}
