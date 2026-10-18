import {
  createOnixMessage,
  createProduct,
  serializeOnix,
  validateOnix,
} from "../src/index.js";

const product = createProduct({
  recordReference: "BOOK-001",
  notificationType: "03",
  isbn: "9780007232833",
  title: "Roseanna",
  productComposition: "00",
  productForm: "BC",
});
const message = createOnixMessage()
  .header({
    sender: { senderName: "Example publisher" },
    sentDateTime: "20250107",
  })
  .product(product)
  .build();
const xml = serializeOnix(message);
console.log(xml);
console.log(await validateOnix(xml));
