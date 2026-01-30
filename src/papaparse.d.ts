declare module 'papaparse' {
  interface ParseResult<T> {
    data: T[];
    errors: Array<{ row: number; type: string; code: string; message: string }>;
    meta: { delimiter: string; linebreak: string; aborted: boolean; fields?: string[]; truncated: boolean };
  }

  interface ParseConfig<T> {
    header?: boolean;
    skipEmptyLines?: boolean;
    complete?: (results: ParseResult<T>) => void;
    error?: (error: Error) => void;
  }

  function parse<T>(input: File | string, config: ParseConfig<T>): void;
}
