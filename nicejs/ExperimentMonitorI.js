// requires deice.js

var ExperimentMonitorI = Ice.Class(nice.api.experiment.ExperimentMonitor, {
  __init__: function(postSubscribeHooks, postSwitchedHooks, postCreatedHooks) {
    this.postSubscribeHooks = (postSubscribeHooks == null) ? [] : postSubscribeHooks;
    this.postSwitchedHooks = (postSwitchedHooks == null) ? [] : postSwitchedHooks;
    this.postCreatedHooks = (postCreatedHooks == null) ? [] : postCreatedHooks;
  },
  onSubscribe: function(all_experiments, current_experiment, __current) {
    var all_experiments = deice(all_experiments);
    this.all_experiments = all_experiments;
    this.current_experiment = current_experiment;
    this.postSubscribeHooks.forEach(function(callback) {
      callback(all_experiments, current_experiment);
    });
  },
  switchedCurrentExperiment: function(current_experiment, __current) {
    this.current_experiment = current_experiment;
    this.postSwitchedHooks.forEach(function(callback) {
      callback(current_experiment);
    });
  },
  modifiedCurrentExperiment: function(data, __current) {
    this._last_modified = data;
  },
  createdExperiment: function(new_experiment, __current) {
    this._last_created = new_experiment;
    this.all_experiments[new_experiment.id] = new_experiment;
    var all = this.all_experiments;
    this.postCreatedHooks.forEach(function(callback) {
      callback(all, new_experiment);
    });
  },
  HashMapToObject: function(m) {
    var obj = {};
    m.forEach(function(dn) {
      obj[dn] = m.get(dn);
    });
    return obj
  }
});
