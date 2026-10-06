import { UNIFIED_BLOCK_TYPES } from "./unifiedConstants";
import { standardCategories } from "../toolbox/toolbox";

/**
 * Toolbox for the "Unified block" branch (Branch C).
 *
 * Presents the all-in-one monolithic blocks as a demo / starting point.
 *
 * The standard Blockly categories (Logic, Math, Text, etc.) are merged in so
 * learners still have the default building blocks available.
 */
export const unifiedToolbox = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Starters",
      colour: "#7c3aed",
      contents: [
        { kind: "label", text: "Canonical Münster procedures" },
        {
          kind: "block",
          type: UNIFIED_BLOCK_TYPES.WORKSHOP_STARTER,
          fields: {
            DATASET: "/data/muenster_measurements_72h.csv",
            PREPROCESS: "CLEAN_SENSOR",
            ANALYSIS: "HOURLY_MEAN",
            OUTPUT: "TIMESERIES",
            LOCATION_DATASET: "/data/muenster_stations.geojson",
            TITLE: "Temperature over time",
          },
        },
        {
          kind: "block",
          type: UNIFIED_BLOCK_TYPES.WORKSHOP_STARTER,
          fields: {
            DATASET: "/data/muenster_measurements_72h.csv",
            PREPROCESS: "CLEAN_SENSOR",
            ANALYSIS: "STATION_COMPARE",
            OUTPUT: "DEVIATION",
            LOCATION_DATASET: "/data/muenster_stations.geojson",
            TITLE: "Station deviation",
          },
        },
        {
          kind: "block",
          type: UNIFIED_BLOCK_TYPES.WORKSHOP_STARTER,
          fields: {
            DATASET: "/data/muenster_measurements_72h.csv",
            PREPROCESS: "CLEAN_SENSOR",
            ANALYSIS: "SPATIAL_JOIN",
            OUTPUT: "LOCATION",
            LOCATION_DATASET: "/data/muenster_stations.geojson",
            TITLE: "Station locations",
          },
        },
      ],
    },
    {
      kind: "category",
      name: "Unified blocks",
      colour: "#7c3aed",
      contents: [
        { kind: "block", type: UNIFIED_BLOCK_TYPES.EXPLORE_DATASET },
        { kind: "block", type: UNIFIED_BLOCK_TYPES.HEAT_ISLANDS_UNIFIED },
      ],
    },
    ...standardCategories,
  ],
};
