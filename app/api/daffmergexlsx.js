import fsp from 'fs-promise';
import sleep from 'sleep-promise';
import opn from 'opn';
import Future from 'fibers/future';
import daff from 'daff';

const Excel = require('exceljs');

export default class DaffMergeXLSX {
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

  async diff(basePath, modifiedPath) {
    const baseData = await DaffMergeXLSX.readData(basePath);
    const modifiedData = await DaffMergeXLSX.readData(modifiedPath);

    const dataDiff = DaffMergeXLSX.daffDiff(baseData, modifiedData);

    const diffPath = `${modifiedPath}_DIFF.xlsx`;
    await DaffMergeXLSX.daffRender(dataDiff, diffPath);

    await this.startProcess(diffPath);

    const updatedDataDiff = await DaffMergeXLSX.readData(diffPath);
    const updatedModifiedData = DaffMergeXLSX.daffPatch(baseData, updatedDataDiff);
    if (updatedModifiedData != null) {
      await DaffMergeXLSX.writeData(updatedModifiedData, modifiedPath);
    }

    await fsp.unlink(diffPath);
  }

  async merge(base, local, remote, merged) {
    // TODO merge with daff

    // TODO create xlsx
    const xlsx = merged;

    await this.startProcess(xlsx);

    // TODO check and save merged
  }

  async startProcess(path) {
    const c = await opn(path);
    this.exitCode = c.exitCode;
    if (this.exitCode !== 0) {
      throw new Error(`error code: ${c.exitCode}`);
    }

    for (;;) {
      try {
        await sleep(1000);

        const fd = await fsp.open(path, 'a');
        await fsp.close(fd);

        break;
      } catch (e) {
        if (e.code !== 'EBUSY') {
          throw e;
        }
      }
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

  static async readData(filePath) {
    const workbook = new Excel.Workbook();
    const reader = filePath.toLowerCase().endsWith('xlsx') ? workbook.xlsx : workbook.csv;
    await reader.readFile(filePath);
    const worksheet = workbook.getWorksheet(1);
    const data = [];
    worksheet.eachRow(true, (row, rowNumber) => {
      data[rowNumber - 1] = row.values.slice(1);
    });
    return data;
  }

  static async writeData(data, filePath) {
    const workbook = new Excel.Workbook();
    const writer = filePath.toLowerCase().endsWith('xlsx') ? workbook.xlsx : workbook.csv;
    const worksheet = workbook.addWorksheet('Sheet');
    worksheet.addRows(data);
    await writer.writeFile(filePath);
  }

  static async writeBytes(bytes, filePath) {
    await fsp.writeFile(filePath, bytes);
  }

  static daffDiff(data1, data2) {
    const dataDiff = [];

    const table1 = new daff.TableView(data1);
    const table2 = new daff.TableView(data2);
    const tableDiff = new daff.TableView(dataDiff);

    const alignment = daff.compareTables(table1, table2).align();
    const flags = new daff.CompareFlags();
    const highlighter = new daff.TableDiff(alignment, flags);
    highlighter.hilite(tableDiff);

    return dataDiff;
  }

  static async daffRender(dataDiff, filePath) {
    const tableDiff = new daff.TableView(dataDiff);
    let bytes = null;
    await Future.task(() => {
      const daffXlsx = new daff.Xlsx();
      bytes = daffXlsx.renderTable(tableDiff);
    }).promise();
    await DaffMergeXLSX.writeBytes(bytes, filePath);
  }

  static daffPatch(data, dataDiff) {
    if (dataDiff.length === 1) {
      return data;
    }

    const table = new daff.TableView(data);
    const tableOrigin = table.clone();
    const tableDiff = new daff.TableView(dataDiff);

    const patcher = new daff.HighlightPatch(table, tableDiff);
    patcher.apply();

    if (table.isSimilar(tableOrigin)) {
      // somthing wrong
      return null;
    }

    return data;
  }
}
