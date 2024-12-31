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

module.exports.Lock = Lock 
