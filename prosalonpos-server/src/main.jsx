import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './main.css';

class ErrorBoundary extends React.Component {
  constructor(props){super(props);this.state={error:null};}
  static getDerivedStateFromError(error){return{error};}
  render(){
    if(this.state.error){
      return React.createElement('div',{style:{background:'#0F172A',color:'#F1F5F9',padding:40,fontFamily:'monospace',height:'100vh',overflow:'auto'}},
        React.createElement('h2',{style:{color:'#EF4444',marginBottom:16}},'App Crashed'),
        React.createElement('pre',{style:{color:'#FCA5A5',whiteSpace:'pre-wrap',fontSize:14}},this.state.error.message),
        React.createElement('pre',{style:{color:'#64748B',whiteSpace:'pre-wrap',fontSize:12,marginTop:16}},this.state.error.stack),
        React.createElement('button',{onClick:()=>window.location.reload(),style:{marginTop:20,padding:'10px 24px',background:'#2563EB',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:14}},'Reload')
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
