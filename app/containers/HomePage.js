// @flow
import { remote } from 'electron';
import React, { Component } from 'react';
import Home from '../components/Home';
import DaffMergeXLS from '../api/daffmergexls';

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

    const daffMerge = new DaffMergeXLS(paths);
    daffMerge.onSuccess = () => this.onSuccess();
    daffMerge.onFail = (message) => this.onFail(message);
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
