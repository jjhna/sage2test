class Rbac {
	constructor(model = {}) {
		this.roles = model.roles || [];
		this.actions = model.actions || [];
		this.permissions = model.permissions || {};
	}

	addRole(role) {
		if (this.roles.indexOf(role) > -1) {
			return false;
		}
		this.roles.push(role);
		return true;
	}

	removeRole(role) {
		if (this.roles.indexOf(role) === -1) {
			return false;
		}
		this.roles.splice(this.roles.indexOf(role), 1);
		return true;
	}

	addAction(action) {
		if (this.actions.indexOf(action) > -1) {
			return false;
		}
		this.actions.push(action);
		return true;
	}

	removeAction(action) {
		if (this.actions.indexOf(action) === -1) {
			return false;
		}
		this.actions.splice(this.actions.indexOf(action), 1);
		return true;
	}

	/* for dev - not sure if useful */
	removeAllPermissions(role) {
		this.permissions[role] = [];
	}

	grantAllPermissions(role) {
		this.permissions[role] = this.permissions.slice();
	}

	removePermission(role, action) {
		if (this.permissions[role] && this.permissions[role].indexOf(action) > -1) {
			this.permissions[role].splice(this.ppermissions.indexOf(role), 1);
			return true;
		}
		return false;
	}

	addPermission(role, action) {
		if (!this.permissions[role]) {
			this.permissions[role] = [action];
		} else if (this.permissions[role].indexOf(action) === -1) {
			return false;
		} else {
			this.permissions[role].push(action);
		}
		return true;
	}

	get model() {
		return {
			roles: this.roles,
			actions: this.actions,
			permissions: this.permissions
		};
	}
}

class RbacManager {

	/* 
	 * 
	 */
	constructor(models) {
		this.rbacs = [];

		if (models) {
			for (let m in models) {
				this.rbacs.push(new Rbac(m));
			}
		}
	}

	new(model) {
		return new Rbac(model);
	}
}

module.exports = RbacManager;
