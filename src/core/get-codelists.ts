import { codelists } from "../generated/codelists.js";

export function getCodelists(): readonly { number: number; heading: string }[] {
  return codelists.map(({ number, heading }) => ({ number, heading }));
}
