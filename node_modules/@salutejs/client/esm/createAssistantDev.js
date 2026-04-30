var createAssistantDev = process.env.NODE_ENV === 'development' ? require('./createAssistantDevOrigin').createAssistantDev : function () { return null; };
var createSmartappDebugger = process.env.NODE_ENV === 'development' ? require('./createAssistantDevOrigin').createSmartappDebugger : function () { return null; };

export { createAssistantDev, createSmartappDebugger };
