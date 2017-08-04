import React from 'react'
import { Router, Route, browserHistory, IndexRoute } from 'react-router';

import Home from './home.js'
import Dashboard from './dashboard.js'
import Main from './main.js'

const routes = ( 
    <Router history={browserHistory}>
        <Route path="/" component={Main} >
            <IndexRoute component={Home} />
            <Route path="/dashboard" component={Dashboard} />
        </Route>
    </Router>
);

export default routes