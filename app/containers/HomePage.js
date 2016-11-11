// @flow
import { remote } from 'electron';
import React, { Component } from 'react';
import Home from '../components/Home';

export default class HomePage extends Component {
  static contextTypes = {
    router: React.PropTypes.object
  };

  componentWillMount() {
    const paths = remote.getGlobal('options').paths;
    if (paths.length < 2) {
      this.context.router.push('/error/Please input file paths to diff or merge.');
    } else if (paths.length === 3) {
      this.context.router.push('/error/No merge output file path.');
    }
  }

  render() {
    return (
      <Home />
    );
  }
}
