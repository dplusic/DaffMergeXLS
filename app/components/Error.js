// @flow
import { remote } from 'electron';
import React, { Component } from 'react';
import { Button, Label } from 'react-desktop/windows';
import styles from './Error.css';


export default class Error extends Component {
  static propTypes = {
    message: React.PropTypes.string.isRequired
  };

  static close() {
    remote.getCurrentWindow().close();
  }

  render() {
    return (
      <div className={styles.container}>
        <Label
          horizontalAlignment="center"
          verticalAlignment="center"
          height="140px"
        >
          {this.props.message}
        </Label>
        <Button
          push
          onClick={Error.close}
        >
          Close
        </Button>
      </div>
    );
  }
}
