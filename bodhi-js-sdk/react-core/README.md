# @bodhiapp/bodhi-js-react

React bindings for Bodhi Browser SDK.

## Installation

```bash
npm install @bodhiapp/bodhi-js-react
```

## Usage

```typescript
import { BodhiProvider, useBodhi } from '@bodhiapp/bodhi-js-react';
import { WebUIClient } from '@bodhiapp/bodhi-js';

const client = new WebUIClient('your-client-id');

function App() {
  return (
    <BodhiProvider client={client}>
      <YourComponents />
    </BodhiProvider>
  );
}
```

## Documentation

See [bodhi-browser/bodhi-js-sdk](https://github.com/BodhiSearch/bodhi-browser/tree/main/bodhi-js-sdk) for complete documentation.

## License

MIT
