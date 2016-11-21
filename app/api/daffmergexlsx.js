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
    this.onNotMerged = null;
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

  async merge(basePath, localPath, remotePath, mergedPath) {
    const baseData = await DaffMergeXLSX.readData(basePath);
    const localData = await DaffMergeXLSX.readData(localPath);
    const remoteData = await DaffMergeXLSX.readData(remotePath);

    const mergingData = DaffMergeXLSX.daffMerge(baseData, localData, remoteData);

    const mergingPath = `${mergedPath}_MERGING.xlsx`;
    await DaffMergeXLSX.daffRenderMerging(mergingData, mergingPath);

    for (;;) {
      await this.startProcess(mergingPath);

      const mergedData = await DaffMergeXLSX.readData(mergingPath);
      if (DaffMergeXLSX.checkMerged(mergedData, mergingData)) {
        await DaffMergeXLSX.writeData(mergedData, mergedPath);
        break;
      }

      if (!await this.callOnNotMerged()) {
        break;
      }
    }

    await fsp.unlink(mergingPath);
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

  async callOnNotMerged() {
    if (this.onNotMerged == null) {
      return false;
    }

    try {
      await new Promise((resolve, reject) => {
        this.onNotMerged(resolve, reject);
      });
      return true;
    } catch (e) {
      return false;
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

  static daffMerge(parentData, localData, remoteData) {
    const parentTable = new daff.TableView(parentData);
    const localTable = new daff.TableView(localData);
    const remoteTable = new daff.TableView(remoteData);

    const flags = new daff.CompareFlags();
    const merger = new daff.Merger(parentTable, localTable, remoteTable, flags);
    merger.apply();
    const conflictInfos = merger.getConflictInfos();

    return { mergedData: localData, conflictInfos };
  }

  static async daffRenderMerging(mergingData, mergingPath) {
    const mergedData = mergingData.mergedData;
    const conflictInfos = mergingData.conflictInfos;

    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Sheet');
    worksheet.addRows(mergedData);

    if (conflictInfos.length > 0) {
      const mergingColumnIndex = worksheet.columnCount + 1;

      worksheet.getCell(1, mergingColumnIndex).value = '_MERGE_';

      conflictInfos.forEach((conflictInfo) => {
        const conflictCell = worksheet.getCell(conflictInfo.row + 1, conflictInfo.col + 1);
        conflictCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: 'FFFF0000'
          }
        };
        const mergingCell = worksheet.getCell(conflictInfo.row + 1, mergingColumnIndex);
        mergingCell.value = 'CONFLICT';
        mergingCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: 'FFAAAAFF'
          }
        };
      });
    }

    await workbook.xlsx.writeFile(mergingPath);
  }

  static checkMerged(mergedData, mergingData) {
    return mergedData[0].length === mergingData.mergedData[0].length;
  }
}
