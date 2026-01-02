// Ambient module declarations for non-TS imports
declare module '*.txt?raw' {
  const content: string;
  export default content;
}
