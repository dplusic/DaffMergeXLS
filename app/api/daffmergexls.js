import opn from 'opn';

export default class DaffMergeXLS {
  constructor(paths) {
    this.paths = paths;

    this.onSuccess = null;
    this.onFail = null;
  }

  async run() {
    try {
      if (this.paths.length === 2) {
        await this.diff(this.paths[0], this.paths[1]);
      } else {
        await this.merge(this.paths[0], this.paths[1], this.paths[2], this.paths[3]);
      }
      this.callOnSuccess();
    } catch (e) {
      this.callOnFail(e.message);
    }
  }

  async diff(base, modified) {
    // TODO diff with daff

    // TODO create xls
    const xls = modified;

    await this.startProcess(xls);

    // TODO patch
  }

  async merge(base, local, remote, merged) {
    // TODO merge with daff

    // TODO create xls
    const xls = merged;

    await this.startProcess(xls);

    // TODO check and save merged
  }

  async startProcess(path) {
    const c = await opn(path);
    this.exitCode = c.exitCode;
    if (this.exitCode !== 0) {
      throw new Error(`error code: ${c.exitCode}`);
    }
  }

  callOnSuccess() {
    if (this.onSuccess != null) {
      this.onSuccess();
    }
  }

  callOnFail(message) {
    if (this.onFail != null) {
      this.onFail(message);
    }
  }
}
