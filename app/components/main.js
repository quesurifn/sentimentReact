import React from 'react'


const Main = (props) => (
  <div className='main-container'>
      {/*this.props.children needs a key to fit w/ transition, so we have to use cloneElement to generate a component that we provide a key to*/}
      {React.cloneElement(props.children, {key: props.location.pathname})}
  </div>
)
export default Main