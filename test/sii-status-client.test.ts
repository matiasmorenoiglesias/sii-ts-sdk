import { test } from "node:test";
import assert from "node:assert/strict";
import { FetchSiiStatusClient } from "../src/adapters/fetch-sii-status-client.js";
import { SiiStatusClientError } from "../src/domain/errors.js";

test("FetchSiiStatusClient.getUploadStatus rechaza un RUT con formato inválido sin llegar a hacer red", async () => {
  const client = new FetchSiiStatusClient();
  await assert.rejects(() => client.getUploadStatus("rut-invalido", "123", "token"), SiiStatusClientError);
});

test("FetchSiiStatusClient.getDteStatus rechaza issueDate con formato inválido sin llegar a hacer red", async () => {
  const client = new FetchSiiStatusClient();
  await assert.rejects(
    () =>
      client.getDteStatus(
        {
          companyRut: "76123456-7",
          recipientRut: "66666666-6",
          documentType: "39",
          folio: 1,
          issueDate: "27/08/2026",
          totalAmount: 1000,
        },
        "token",
      ),
    SiiStatusClientError,
  );
});
