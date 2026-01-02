# @bodhiapp/bodhi-js-ext

Extension SDK for Bodhi Browser - `chrome.runtime` communication.

## Installation

```bash
npm install @bodhiapp/bodhi-js-ext
```

## Usage

```typescript
import { ExtUIClient } from '@bodhiapp/bodhi-js-ext';

const client = new ExtUIClient('your-extension-client-id');
await client.init();
```

## Documentation

See [bodhi-browser/bodhi-js-sdk](https://github.com/BodhiSearch/bodhi-browser/tree/main/bodhi-js-sdk) for complete documentation.

## License

MIT
