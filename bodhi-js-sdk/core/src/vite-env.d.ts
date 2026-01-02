/// <reference types="vite/client" />

// Allow importing .html files as raw strings
declare module '*.html?raw' {
  const content: string;
  export default content;
}
