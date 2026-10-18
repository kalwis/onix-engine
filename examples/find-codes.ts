import { getCode, getList, getThemaEntry, searchCodes } from "../src/index.js";

console.log(getList(150)?.heading);
console.log(getCode(150, "BC"));
console.log(searchCodes("paperback", { list: 150 }).slice(0, 5));
console.log(getThemaEntry("AB"));
