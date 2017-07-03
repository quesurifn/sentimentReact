import React from 'react'
import styles from '../styles.css'

import { Link } from 'react-router'


class Dashboard extends React.Component {
    constructor(props) {
        super(props);
        
        this.state = {
            tweet: '',
            overallSentiment: 0
        }
    }
    

    componentDidMount() {
        var connection = new WebSocket('ws://trump-sentiment.herokuapp.com/');
        
        connection.onmessage = (e) => {
            e = JSON.parse(e.data)
            console.log(e)
            if (e.main) {
                this.setState({
                    tweet: e.main.featuredTweet,
                    overallSentiment: e.main.sentiment
                })
            }
        }
    }


    render() {
        return (
            <div>
              <div className="Tweet">{this.state.tweet}</div>
            </div>
        );
    }
}
export default Dashboard