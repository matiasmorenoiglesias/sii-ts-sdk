import { test } from "node:test";
import assert from "node:assert/strict";
import { FetchEnvioBoletaUploader } from "../src/adapters/fetch-envio-boleta-uploader.js";
import { EnvioBoletaUploaderError } from "../src/domain/errors.js";

test("FetchEnvioBoletaUploader rechaza un RUT con formato inválido sin llegar a hacer red", async () => {
  const uploader = new FetchEnvioBoletaUploader();

  await assert.rejects(
    () => uploader.upload("<EnvioBOLETA/>", "rut-invalido", "66666666-6", "token"),
    EnvioBoletaUploaderError,
  );
});
