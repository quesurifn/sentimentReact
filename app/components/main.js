import React from 'react'
import ReactCSSTransitionGroup from 'react-addons-css-transition-group'

const Main = (props) => (
  <div className='main-container'>
    <ReactCSSTransitionGroup
      transitionName="appear"
      transitionEnterTimeout={500}
      transitionLeaveTimeout={500}>
      {/*this.props.children needs a key to fit w/ transition, so we have to use cloneElement to generate a component that we provide a key to*/}
      {React.cloneElement(props.children, {key: props.location.pathname})}
    </ReactCSSTransitionGroup>
  </div>
)
export default Main