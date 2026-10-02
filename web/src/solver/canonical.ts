// Canonicalisation now lives with the rest of the symmetry analysis, since it
// needs the tiling's primitive translation lattice to dedupe equivalent
// descriptions (including supercell descriptions of the same tiling).
export {
  canonicalSignature,
  sameTessellation,
} from "./symmetry.ts";
