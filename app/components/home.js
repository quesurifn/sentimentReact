import React from 'react'
import styles from '../styles.css'

import { Link } from 'react-router'


const Home = () => (
    <div>
        <img className="title" src={require('../public/images/sentiment.jpg')}/>
        <div className="homeFlex">
            <Link to="/dashboard">
                <img className="trump" src={require('../public/images/trump2.jpg')} />
            </Link>
            <Link to="/dashboard/:trend"> 
                <img className="twitter" src={require('../public/images/twitter.png')} ></img>
            </Link>
        </div>
    </div>
);


export default Home