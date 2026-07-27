"use strict";

const {
  assertIdentityDatabaseBoundary,
  createIdentityPrismaAccess,
} = require("./prisma-access");

let singletonAccess = null;

function resolvePrismaClient(PrismaClientImpl) {
  if (PrismaClientImpl) return PrismaClientImpl;
  return require("@prisma/client").PrismaClient;
}

function createIdentityService({
  environment = process.env,
  PrismaClientImpl,
} = {}) {
  assertIdentityDatabaseBoundary(environment);
  const Client = resolvePrismaClient(PrismaClientImpl);
  return createIdentityPrismaAccess(new Client());
}

function getIdentityService(options = {}) {
  if (!singletonAccess) {
    singletonAccess = createIdentityService(options);
  }
  return singletonAccess;
}

async function disconnectIdentityService() {
  if (!singletonAccess) return;
  const access = singletonAccess;
  singletonAccess = null;
  await access.disconnect();
}

module.exports = {
  createIdentityService,
  disconnectIdentityService,
  getIdentityService,
};
