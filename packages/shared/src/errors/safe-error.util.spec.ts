import { isSafePublicMessage } from './safe-error.util';

describe('isSafePublicMessage', () => {
  it('TEST A: isSafePublicMessage(["ECONNREFUSED 10.0.0.5:5432"]) -> false', () => {
    expect(isSafePublicMessage(["ECONNREFUSED 10.0.0.5:5432"])).toBe(false);
  });

  it('TEST B: isSafePublicMessage(["P1001"]) -> false', () => {
    expect(isSafePublicMessage(["P1001"])).toBe(false);
  });

  it('TEST C: isSafePublicMessage(["relation \\"users\\" does not exist"]) -> false', () => {
    expect(isSafePublicMessage(["relation \"users\" does not exist"])).toBe(false);
  });

  it('TEST D: isSafePublicMessage(["ENOENT"]) -> false', () => {
    expect(isSafePublicMessage(["ENOENT"])).toBe(false);
  });

  it('TEST E: mixed array -> false', () => {
    expect(isSafePublicMessage(["Invalid credentials", "ECONNREFUSED 10.0.0.5:5432"])).toBe(false);
  });

  it('TEST F: approved array -> true', () => {
    expect(isSafePublicMessage(["Invalid credentials", "Forbidden"])).toBe(true);
  });

  it('TEST G: nested array -> false', () => {
    expect(isSafePublicMessage([["Invalid credentials"]])).toBe(false);
  });

  it('TEST H: object array -> false', () => {
    expect(isSafePublicMessage([{message: "Invalid credentials"}])).toBe(false);
  });

  it('TEST I: non-string array values -> false', () => {
    expect(isSafePublicMessage(["Invalid credentials", 123])).toBe(false);
  });

  it('TEST J: empty array -> safe behavior according to explicitly chosen contract', () => {
    expect(isSafePublicMessage([])).toBe(true);
  });
});
