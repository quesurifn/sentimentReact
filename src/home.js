import React from 'react'


import { Link } from 'react-router'


const Home = () => (
    <div>
        <img className="title" src={require('./images/sentiment.jpg')}/>
        <div className="homeFlex">
            <Link to="/dashboard">
                <img className="trump" src={require('./images/trump2.jpg')} />
            </Link>
            <Link to="/dashboard/:trend"> 
                <img className="twitter" src={require('./images/twitter.png')} ></img>
            </Link>
        </div>
    </div>
);


export default Home