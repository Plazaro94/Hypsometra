# @hypsometra/data

Capa de **datos de mercado** desacoplada del engine.

## Contrato

```ts
interface MarketDataSource {
  kind: "csv" | "catalog" | "mt5";
  load(request): Promise<Bar[]>;
}
```

| Source | Estado |
|--------|--------|
| `CsvLocalSource` | **v1** — ingestión CSV → almacén local |
| `CatalogSource` | Reservado (series hospedadas) |
| `Mt5BridgeSource` | Reservado (puente MT5 / MetaApi) |

## Ingestión

```ts
import { ingestCsvFile, CsvLocalSource } from "@hypsometra/data";

const { meta } = ingestCsvFile({
  filePath: "./XAUUSD_H1.csv",
  symbol: "XAUUSD",
  timeframe: "H1",
});

const bars = await new CsvLocalSource().load({ datasetId: meta.id });
```

Layout en disco: `data/datasets/{id}/meta.json` + `bars.jsonl`.
