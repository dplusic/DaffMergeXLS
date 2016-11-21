// @flow
import { remote } from 'electron';
import React, { Component } from 'react';
import Home from '../components/Home';
import DaffMergeXLSX from '../api/daffmergexlsx';

export default class HomePage extends Component {
  static contextTypes = {
    router: React.PropTypes.object
  };

  componentWillMount() {
    const paths = remote.getGlobal('options').paths;
    if (paths.length < 2) {
      this.context.router.push('/error/Please input file paths to diff or merge.');
      return;
    } else if (paths.length === 3) {
      this.context.router.push('/error/No merge output file path.');
      return;
    }

    const daffMerge = new DaffMergeXLSX(paths);
    daffMerge.onSuccess = () => this.onSuccess();
    daffMerge.onFail = (message) => this.onFail(message);
    daffMerge.onNotMerged = (resolve, reject) => this.onNotMerged(resolve, reject);
    daffMerge.run();
  }

  onSuccess() {
    this.close();
  }

  onFail(message) {
    if (message) {
      this.context.router.push(`/error/${message}`);
    } else {
      this.context.router.push('/error/ERROR');
    }
  }

  onNotMerged(resolve, reject) {
    // TODO show confirm message
    this.context.router.push('/error/Not Merged');
    reject();
  }

  close() {
    remote.getCurrentWindow().close();
    this.closed = true;
  }

  render() {
    return (
      <Home />
    );
  }
}
