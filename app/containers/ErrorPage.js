/* eslint react/forbid-prop-types: ["error", { "forbid": ["any", "array"] }] */
// @flow
import React, { Component } from 'react';
import Error from '../components/Error';

export default class ErrorPage extends Component {
  static propTypes = {
    params: React.PropTypes.object.isRequired
  };

  render() {
    return (
      <Error
        message={this.props.params.message}
      />
    );
  }
}
