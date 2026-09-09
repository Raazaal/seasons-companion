import { randomInt, randomUUID } from "node:crypto";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateJoinCode(length = 4) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[randomInt(CODE_CHARS.length)];
  }
  return code;
}

export function generateId() {
  return randomUUID();
}

export function generateToken() {
  return randomUUID();
}
