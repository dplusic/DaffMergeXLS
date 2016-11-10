// @flow
import { remote } from 'electron';
import React, { Component } from 'react';
import { Button, ProgressCircle } from 'react-desktop/windows';
import styles from './Home.css';


export default class Home extends Component {
  static abort() {
    remote.getCurrentWindow().close();
  }

  render() {
    return (
      <div>
        <div className={styles.container}>
          <ProgressCircle
            color="#cccccc"
            size="70"
            style={{ margin: '40px auto' }}
          />
          <Button
            push
            onClick={Home.abort}
          >
            Abort
          </Button>
        </div>
      </div>
    );
  }
}
