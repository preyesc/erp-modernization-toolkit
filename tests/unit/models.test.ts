import { describe, it, expect } from 'vitest';
import {
  ToolkitError,
  InvalidPathError,
  NoSourceFilesError,
  SchemaValidationError,
  JsonParseError,
  InvalidReportError,
  InvalidPlanError,
  ExportIOError,
} from '../../src/models/errors';

describe('ToolkitError', () => {
  it('should create a base error with code, message and details', () => {
    const err = new ToolkitError('TEST', 'test message', { key: 'value' });
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('TEST');
    expect(err.message).toBe('test message');
    expect(err.details).toEqual({ key: 'value' });
    expect(err.name).toBe('ToolkitError');
  });

  it('should work without details', () => {
    const err = new ToolkitError('TEST', 'test message');
    expect(err.details).toBeUndefined();
  });
});

describe('InvalidPathError', () => {
  it('should include the path in message and details', () => {
    const err = new InvalidPathError('/some/path');
    expect(err.code).toBe('INVALID_PATH');
    expect(err.message).toContain('/some/path');
    expect(err.details).toEqual({ path: '/some/path' });
  });
});

describe('NoSourceFilesError', () => {
  it('should include the path in message and details', () => {
    const err = new NoSourceFilesError('/empty/dir');
    expect(err.code).toBe('NO_SOURCE_FILES');
    expect(err.message).toContain('/empty/dir');
    expect(err.details).toEqual({ path: '/empty/dir' });
  });
});

describe('SchemaValidationError', () => {
  it('should include schema name and errors', () => {
    const err = new SchemaValidationError('AnalysisReport', ['missing field: metadata']);
    expect(err.code).toBe('SCHEMA_VALIDATION');
    expect(err.message).toContain('AnalysisReport');
    expect(err.details).toEqual({ schemaName: 'AnalysisReport', errors: ['missing field: metadata'] });
  });
});

describe('JsonParseError', () => {
  it('should include parse error message and position', () => {
    const err = new JsonParseError('Unexpected token', 42);
    expect(err.code).toBe('JSON_PARSE');
    expect(err.message).toContain('Unexpected token');
    expect(err.details).toEqual({ position: 42 });
  });
});

describe('InvalidReportError', () => {
  it('should include the reason', () => {
    const err = new InvalidReportError('missing modules');
    expect(err.code).toBe('INVALID_REPORT');
    expect(err.message).toContain('missing modules');
    expect(err.details).toEqual({ reason: 'missing modules' });
  });
});

describe('InvalidPlanError', () => {
  it('should include the reason', () => {
    const err = new InvalidPlanError('no services');
    expect(err.code).toBe('INVALID_PLAN');
    expect(err.message).toContain('no services');
    expect(err.details).toEqual({ reason: 'no services' });
  });
});

describe('ExportIOError', () => {
  it('should include path and reason', () => {
    const err = new ExportIOError('/output/dir', 'permission denied');
    expect(err.code).toBe('EXPORT_IO');
    expect(err.message).toContain('permission denied');
    expect(err.message).toContain('/output/dir');
    expect(err.details).toEqual({ path: '/output/dir', reason: 'permission denied' });
  });
});

describe('Error inheritance', () => {
  it('all error subclasses should be instances of ToolkitError and Error', () => {
    const errors = [
      new InvalidPathError('/path'),
      new NoSourceFilesError('/path'),
      new SchemaValidationError('schema', []),
      new JsonParseError('msg'),
      new InvalidReportError('reason'),
      new InvalidPlanError('reason'),
      new ExportIOError('/path', 'reason'),
    ];
    for (const err of errors) {
      expect(err).toBeInstanceOf(ToolkitError);
      expect(err).toBeInstanceOf(Error);
    }
  });
});
