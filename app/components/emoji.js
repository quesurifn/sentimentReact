import React from 'react'
import styles from '../styles.css'


export class EmojiSentiment extends React.Component {
   
    render() {

        let emoji = null;
        if (this.props.score > 0) {
            emoji = <p className="bigNumEmoji">😁</p>;
        } else if (this.props.score < 0) {
            emoji = <p className="bigNumEmoji">😔</p>;
        } else if (this.props.score === 0) {
            emoji = <p className="bigNumEmoji">😐</p>;
        }

        return (
            <div>
                {emoji}
            </div>
        );
    }

}