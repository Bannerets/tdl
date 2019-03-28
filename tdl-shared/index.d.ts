
export interface TDLibClient { readonly _TDLibClientBrand: void }
export declare function makeTDLibClient (x: any): TDLibClient

export interface ITDLibJSON {
  create(): Promise<TDLibClient>;
  destroy(client: TDLibClient): void;
  execute(client: TDLibClient, query: Object): Object | null;
  receive(client: TDLibClient, timeout: number): Promise<Object | null>;
  send(client: TDLibClient, query: Object): void;
  setLogFilePath(path: string): number;
  setLogMaxFileSize(maxFileSize: number | string): void;
  setLogVerbosityLevel(verbosity: number): void;
  setLogFatalErrorCallback(fn: null | ((errorMessage: string) => void)): void;
}

export interface IAsyncTDLibJSON {
  create(): Promise<TDLibClient>;
  destroy(client: TDLibClient): Promise<void>;
  execute(client: TDLibClient, query: Object): Promise<Object | null>;
  receive(client: TDLibClient, timeout: number): Promise<Object | null>;
  send(client: TDLibClient, query: Object): Promise<void>;
  setLogFilePath(path: string): Promise<number>;
  setLogMaxFileSize(maxFileSize: number | string): Promise<void>;
  setLogVerbosityLevel(verbosity: number): Promise<void>;
  setLogFatalErrorCallback(fn: null | ((errorMessage: string) => void)): Promise<void>;
}
