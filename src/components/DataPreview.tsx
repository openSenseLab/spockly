import { Badge, Box, Flex, Table, Text } from "@radix-ui/themes";

import { formatNumber, t } from "../i18n";

/** pandas' type names in words students know. */
function typeWord(dtype: string): string {
  if (/^datetime64/.test(dtype)) return t("dtype.date");
  if (/^(u?int|Int|UInt)/.test(dtype)) return t("dtype.integer");
  if (/^(float|Float)/.test(dtype)) return t("dtype.number");
  if (/^bool/.test(dtype)) return t("dtype.bool");
  return t("dtype.text");
}

const shown = (value: unknown) =>
  value === null || value === undefined
    ? "–"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);

/**
 * The first rows of a table, with each column's type: what a step made, or
 * what a "zeige als Tabelle" block shows. Scrolls in one box with the
 * column names staying on top. With `fill` the box takes the height that is
 * left (the Zwischenstand), so its scrollbars are always in view.
 */
export function DataPreview({
  columns,
  types,
  rows,
  total,
  fill = false,
}: {
  columns: string[];
  types: Record<string, string>;
  rows: unknown[][];
  total: number;
  fill?: boolean;
}) {
  return (
    <Flex
      direction="column"
      gap="2"
      className={fill ? "preview-fill" : undefined}
    >
      <Text size="2" color="gray">
        {t("data.size", {
          rows: total === 1 ? t("data.rowOne") : t("data.rows", { count: formatNumber(total) }),
          columns: columns.length === 1 ? t("data.columnOne") : t("data.columns", { count: formatNumber(columns.length) }),
        })}
        {rows.length < total &&
          ` · ${t("data.firstRows", { count: formatNumber(rows.length) })}`}
      </Text>
      <Box className="table-scroll">
        <Table.Root
          size="1"
          variant="surface"
          className="scroll-table preview-table"
        >
          <Table.Header>
            <Table.Row>
              {columns.map((name) => (
                <Table.ColumnHeaderCell key={name}>
                  <Flex direction="column" gap="1">
                    <Text weight="bold">{name}</Text>
                    <Badge size="1" color="gray" variant="soft">
                      {typeWord(types[name] ?? "object")}
                    </Badge>
                  </Flex>
                </Table.ColumnHeaderCell>
              ))}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map((row, i) => (
              <Table.Row key={i}>
                {row.map((value, j) => (
                  <Table.Cell key={j} className="preview-cell">
                    {shown(value)}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>
    </Flex>
  );
}
