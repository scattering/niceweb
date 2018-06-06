var ExperimentMonitorI = class extends nice.api.experiment.ExperimentMonitor {
  constructor(postSubscribeHooks, postSwitchedHooks, postCreatedHooks) {
    super();
    var _resolve, _reject;
    this.subscribed = new Promise(function(resolve, reject) {
        _resolve = resolve;
        _reject = reject;
    })
    this.postSubscribeHooks = (postSubscribeHooks == null) ? [] : postSubscribeHooks;
    this.postSwitchedHooks = (postSwitchedHooks == null) ? [] : postSwitchedHooks;
    this.postCreatedHooks = (postCreatedHooks == null) ? [] : postCreatedHooks;
    this.postSubscribeHooks.push(function() { _resolve() });
  }
  onSubscribe(all_experiments, current_experiment, __current) {
    this.all_experiments = all_experiments;
    this.current_experiment = current_experiment;
    this.postSwitchedHooks.forEach(function(callback) {
      callback(current_experiment);
    });
    this.postSubscribeHooks.forEach(function(callback) { 
      callback(current_experiment) 
    });
  }
  switchedCurrentExperiment(current_experiment, __current) {
    this.current_experiment = current_experiment;
    this.postSwitchedHooks.forEach(function(callback) {
      callback(current_experiment);
    });
  }
  modifiedCurrentExperiment(data, __current) {
    this._last_modified = data;
  }
  createdExperiment(data, __current) {
    this._last_created = data;
  }
};
