import React from 'react'


const Main = (props) => (
  <div className='main-container'>
      {React.cloneElement(props.children, {key: props.location.pathname})}
  </div>
)
export default Main