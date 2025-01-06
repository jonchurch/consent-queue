class Lock {
  constructor() {
    this.promise = null;
  }

  async run(task) {
    if (!this.promise) {
      this.promise = task()
        .catch((err) => {
          this.promise = null; // Reset on failure
          throw err;
        })
        .finally(() => {
          this.promise = null; // Reset after completion
        });
    }
    return this.promise;
  }
}


// Calculate hours open
function hoursOpen(sinceDate) {
  const diffMs = Date.now() - Date.parse(sinceDate);
  const hours = diffMs / 3600000;
  return hours.toFixed(2);
}

module.exports = {
  Lock,
  hoursOpen
}
