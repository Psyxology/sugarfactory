(function() {
	async function e(e = {}) {
		var t = e, r = !!globalThis.window, n = !!globalThis.WorkerGlobalScope;
		globalThis.process?.versions?.node && globalThis.process;
		var a, o = (e, t) => {
			throw t;
		}, i = self.location.href, s = "";
		if (r || n) {
			try {
				s = new URL(".", i).href;
			} catch {}
			n && (a = (e) => {
				var t = new XMLHttpRequest();
				return t.open("GET", e, !1), t.responseType = "arraybuffer", t.send(null), new Uint8Array(t.response);
			});
		}
		var c, u, l = console.log.bind(console), f = console.error.bind(console), d = !1;
		class p {}
		class h extends p {
			constructor(e) {
				super(), this.excPtr = e;
			}
		}
		const y = 34821223, w = 2310721022;
		function b(e) {
			return "0x" + (e >>> 0).toString(16).padStart(8, "0");
		}
		function _() {
			if (!d) {
				var e = ce();
				0 == e && (e += 4);
				var t, r = A[e >> 2], n = A[e + 4 >> 2];
				r == y && n == w || x(`Stack overflow! Stack cookie has been overwritten at ${t = e, "0x" + (t >>>= 0).toString(16).padStart(8, "0")}, expected hex dwords ${b(w)} and ${b(y)}, but received ${b(n)} ${b(r)}`), 1668509029 != A[0] && x("Runtime error: The application has corrupted its heap memory area (address zero)!");
			}
		}
		var m, g, v, A, D = !1;
		function S() {
			if (!v?.buffer?.resizable) {
				var e = pe.buffer;
				v = new Int8Array(e), t.HEAPU8 = R = new Uint8Array(e), g = new Int32Array(e), t.HEAPU32 = A = new Uint32Array(e), Q = new Float32Array(e), W = new Float64Array(e), O = new BigInt64Array(e);
			}
		}
		function x(e) {
			throw t.onAbort?.(e), f(e = `Aborted(${e})`), d = !0, e += ". Build with -sASSERTIONS for more info.", new WebAssembly.RuntimeError(e);
		}
		function k() {
			return t.locateFile ? s + "Diablo.wasm" : new URL("Diablo.wasm", "" + self.location.href).href;
		}
		function T(e, t) {
			var r, n = function(e) {
				if (e == m && c) return new Uint8Array(c);
				if (a) return a(e);
				throw "sync fetching of the wasm failed: you can preload it to Module[\"wasmBinary\"] manually, or emcc.py will do that for you when generating HTML (but not JS)";
			}(e);
			return r = new WebAssembly.Module(n), [new WebAssembly.Instance(r, t), r];
		}
		class C {
			name = "ExitStatus";
			constructor(e) {
				this.message = `Program terminated with exit(${e})`, this.status = e;
			}
		}
		var E = (e) => {
			for (; e.length > 0;) e.shift()(t);
		}, I = [], L = [], P = !0;
		var R, U = globalThis.TextDecoder && new TextDecoder(), M = (e, t = 0, r, n) => {
			var a = ((e, t, r, n) => {
				var a = t + r;
				if (n) return a;
				for (; e[t] && !(t >= a);) ++t;
				return t;
			})(e, t, r, n);
			if (a - t > 16 && e.buffer && U) return U.decode(e.subarray(t, a));
			for (var o = ""; t < a;) {
				var i = e[t++];
				if (128 & i) {
					var s = 63 & e[t++];
					if (192 != (224 & i)) {
						var c = 63 & e[t++];
						if ((i = 224 == (240 & i) ? (15 & i) << 12 | s << 6 | c : (7 & i) << 18 | s << 12 | c << 6 | 63 & e[t++]) < 65536) o += String.fromCharCode(i);
						else {
							var u = i - 65536;
							o += String.fromCharCode(55296 | u >> 10, 56320 | 1023 & u);
						}
					} else o += String.fromCharCode((31 & i) << 6 | s);
				} else o += String.fromCharCode(i);
			}
			return o;
		}, $ = (e, t, r) => e ? M(R, e, t, r) : "", B = null;
		class N {
			constructor(e) {
				this.excPtr = e, this.ptr = e - 24;
			}
			set_type(e) {
				A[this.ptr + 4 >> 2] = e;
			}
			get_type() {
				return A[this.ptr + 4 >> 2];
			}
			set_destructor(e) {
				A[this.ptr + 8 >> 2] = e;
			}
			get_destructor() {
				return A[this.ptr + 8 >> 2];
			}
			set_caught(e) {
				e = e ? 1 : 0, v[this.ptr + 12] = e;
			}
			get_caught() {
				return 0 != v[this.ptr + 12];
			}
			set_rethrown(e) {
				e = e ? 1 : 0, v[this.ptr + 13] = e;
			}
			get_rethrown() {
				return 0 != v[this.ptr + 13];
			}
			init(e, t) {
				this.set_adjusted_ptr(0), this.set_type(e), this.set_destructor(t);
			}
			set_adjusted_ptr(e) {
				A[this.ptr + 16 >> 2] = e;
			}
			get_adjusted_ptr() {
				return A[this.ptr + 16 >> 2];
			}
		}
		var W, O, q = (e) => ie(e), j = 0, z = {}, H = (e) => {
			if (e instanceof C || "unwind" == e) return u;
			_(), e instanceof WebAssembly.RuntimeError && le() <= 0 && f("Stack overflow detected.  You can try increasing -sSTACK_SIZE (currently set to 65536)"), o(0, e);
		}, F = () => P || j > 0, G = (e) => {
			u = e, F() || (d = !0), o(0, new C(e));
		}, K = (e, t) => {
			u = e, G(e);
		}, J = (e) => {
			if (!d) try {
				return e();
			} catch (t) {
				H(t);
			} finally {
				(() => {
					if (!F()) try {
						K(u);
					} catch (t) {
						H(t);
					}
				})();
			}
		}, X = [], Y = (e, t, r) => {
			var n = ((e, t) => {
				var r;
				for (X.length = 0; r = R[e++];) {
					var n = 105 != r;
					t += (n &= 112 != r) && t % 8 ? 4 : 0, X.push(112 == r ? A[t >> 2] : 106 == r ? O[t >> 3] : 105 == r ? g[t >> 2] : W[t >> 3]), t += n ? 8 : 4;
				}
				return X;
			})(t, r);
			return ye[e](...n);
		}, Z = (e, t) => Math.ceil(e / t) * t, V = (e) => {
			var t = (e - pe.buffer.byteLength + 65535) / 65536 | 0;
			try {
				return pe.grow(t), S(), 1;
			} catch (r) {}
		};
		var Q, ee = [
			null,
			[],
			[]
		], te = (e, t) => {
			var r = ee[e];
			t && 10 !== t ? r.push(t) : ((1 === e ? l : f)(M(r)), r.length = 0);
		}, re = [];
		t.noExitRuntime && (P = t.noExitRuntime), t.print && (l = t.print), t.printErr && (f = t.printErr), t.wasmBinary && (c = t.wasmBinary), t.arguments && t.arguments, t.thisProgram && t.thisProgram;
		var ne = t.preInit;
		if (ne) for ("function" == typeof ne && (t.preInit = ne = [ne]); ne.length > 0;) ne.shift()();
		var ae, oe, ie, se, ce, ue, le, fe, de, pe, he, ye = { 275150: (e) => {
			self.DApi.current_save_id(e);
		} };
		var we = {
			K: (e, t, r, n) => x(`Assertion failed: ${$(e)}, at: ` + [
				t ? $(t) : "unknown filename",
				r,
				n ? $(n) : "unknown function"
			]),
			w: () => ((e) => {
				var t = B?.excPtr;
				if (!t) return q(0), 0;
				var r = new N(t);
				r.set_adjusted_ptr(t);
				var n = r.get_type();
				if (!n) return q(0), t;
				for (var a of e) {
					if (!a || a === n) break;
					var o = r.ptr + 16;
					if (de(a, n, o)) return q(a), t;
				}
				return q(n), t;
			})([]),
			e: (e, t, r) => {
				throw new N(e).init(t, r), fe(e), B = new h(e), B;
			},
			v: (e) => {
				throw B || (B = new h(e)), B;
			},
			G: () => x(""),
			r: function() {
				self.DApi.close_keyboard();
			},
			f: function(e, t, r, n, a) {
				self.DApi.open_keyboard(e, t, r, n, a);
			},
			B: () => {
				P = !1, j = 0;
			},
			y: (e, t) => (z[e] && (clearTimeout(z[e].id), delete z[e]), t ? (z[e] = {
				id: setTimeout(() => {
					delete z[e], J(() => ae(e, performance.now()));
				}, t),
				timeout_ms: t
			}, 0) : 0),
			I: function(e, t, r) {
				self.DApi.create_sound(e, R.slice(t, t + r));
			},
			J: function(e, t, r, n, a) {
				self.DApi.create_sound_raw(e, Q.slice(t / 4, t / 4 + r * n), r, n, a);
			},
			a: function(e) {
				self.DApi.delete_sound(e);
			},
			j: function() {
				self.DApi.draw_begin();
			},
			t: function(e) {
				self.DApi.draw_belt(g.subarray(e / 4, e / 4 + 8));
			},
			g: function(e, t, r, n, a) {
				self.DApi.draw_blit(e, t, r, n, R.subarray(a, a + r * n * 4));
			},
			u: function(e, t, r, n) {
				self.DApi.draw_clip_text(e, t, r, n);
			},
			i: function() {
				self.DApi.draw_end();
			},
			m: function(e, t, r, n) {
				var a = R.indexOf(0, r), o = String.fromCharCode.apply(null, R.subarray(r, a));
				self.DApi.draw_text(e, t, o, n);
			},
			H: function(e, t) {
				self.DApi.duplicate_sound(e, t);
			},
			N: function() {
				self.DApi.exit_game();
			},
			o: function(e, t, r, n) {
				self.DApi.play_sound(e, t, r, n);
			},
			d: function(e, t) {
				self.DApi.set_cursor(e, t);
			},
			n: function(e, t) {
				self.DApi.set_volume(e, t);
			},
			b: function(e) {
				self.DApi.stop_sound(e);
			},
			k: function(e) {
				self.DApi.use_websocket(e);
			},
			L: function() {
				return self.DApi.websocket_closed();
			},
			M: function(e, t) {
				self.DApi.websocket_send(R.subarray(e, e + t));
			},
			l: (e, t, r) => Y(e, t, r),
			F: () => Date.now(),
			z: (e) => {
				var t = R.length, r = 2147483648;
				if ((e >>>= 0) > r) return !1;
				for (var n = 1; n <= 4; n *= 2) {
					var a = t * (1 + .2 / n);
					if (a = Math.min(a, e + 100663296), V(Math.min(r, Z(Math.max(e, a), 65536)))) return !0;
				}
				return !1;
			},
			c: K,
			s: function(e) {
				var t = R.indexOf(0, e), r = String.fromCharCode.apply(null, R.subarray(e, t));
				self.DApi.exit_error(r);
			},
			D: (e) => 52,
			C: function(e, t, r, n) {
				var a;
				return t = (a = t) < -9007199254740992 || a > 9007199254740992 ? NaN : Number(a), 70;
			},
			E: (e, t, r, n) => {
				for (var a = 0, o = 0; o < r; o++) {
					var i = A[t >> 2], s = A[t + 4 >> 2];
					t += 8;
					for (var c = 0; c < s; c++) te(e, R[i + c]);
					a += s;
				}
				return A[n >> 2] = a, 0;
			},
			h: function(e, t, r, n) {
				var a = R.indexOf(0, e), o = String.fromCharCode.apply(null, R.subarray(e, a));
				self.DApi.get_file_contents(o, R.subarray(t, t + n), r);
			},
			q: function(e) {
				var t = R.indexOf(0, e), r = String.fromCharCode.apply(null, R.subarray(e, t));
				return self.DApi.get_file_size(r);
			},
			x: function(e, t) {
				var r = le();
				try {
					return ((a = re[n = e]) || (re[n] = a = he.get(n)), a)(t);
				} catch (o) {
					if (ue(r), !(o instanceof p)) throw o;
					oe(1, 0);
				}
				var n, a;
			},
			A: G,
			p: function(e, t, r) {
				var n = R.indexOf(0, e), a = String.fromCharCode.apply(null, R.subarray(e, n));
				self.DApi.put_file_contents(a, R.slice(t, t + r));
			},
			O: function(e) {
				var t = R.indexOf(0, e), r = String.fromCharCode.apply(null, R.subarray(e, t));
				self.DApi.remove_file(r);
			}
		};
		function be() {
			var e;
			se(), 0 == (e = ce()) && (e += 4), A[e >> 2] = y, A[e + 4 >> 2] = w, A[0] = 1668509029;
		}
		var _e, me, ge = (me = { a: we }, m ??= k(), _e = T(m, me)[0], function(e) {
			t._DApi_SyncTextPtr = e.R, t._DApi_Init = e.S, t._DApi_Mouse = e.T, t._DApi_Key = e.U, t._DApi_Char = e.V, t._DApi_Render = e.W, t._DApi_SyncText = e.X, t._DApi_AllocPacket = e.Y, t._SNet_InitWebsocket = e.Z, t._SNet_WebsocketStatus = e._, ae = e.aa, oe = e.ba, ie = e.ca, se = e.da, ce = e.ea, ue = e.fa, le = e.ga, fe = e.ha, de = e.ia, e.ja, pe = e.P, he = e.$;
		}(ge = _e.exports), S(), ge);
		return await async function() {
			be(), function() {
				var e = t.preRun;
				e && ("function" == typeof e && (e = [e]), L.push(...e)), E(L);
			}();
			var e = t.setStatus;
			e && (e("Running..."), await new Promise((e) => setTimeout(e, 1)), setTimeout(e, 1, "")), d || (D = !0, _(), ge.Q(), _(), t.onRuntimeInitialized?.(), function() {
				_();
				var e = t.postRun;
				e && ("function" == typeof e && (e = [e]), I.push(...e)), E(I);
			}());
		}(), t.ready = new Promise(function(e, r) {
			delete t.then, t.onAbort = function(e) {
				r(e);
			};
			const n = function() {
				e(t);
			};
			var a;
			D ? n() : (a = n, I.push(a));
		}), t;
	}
	async function t(e = {}) {
		var t = e, r = !!globalThis.window, n = !!globalThis.WorkerGlobalScope;
		globalThis.process?.versions?.node && globalThis.process;
		var a, o = (e, t) => {
			throw t;
		}, i = self.location.href, s = "";
		if (r || n) {
			try {
				s = new URL(".", i).href;
			} catch {}
			n && (a = (e) => {
				var t = new XMLHttpRequest();
				return t.open("GET", e, !1), t.responseType = "arraybuffer", t.send(null), new Uint8Array(t.response);
			});
		}
		var c, u, l = console.log.bind(console), f = console.error.bind(console), d = !1;
		class p {}
		class h extends p {
			constructor(e) {
				super(), this.excPtr = e;
			}
		}
		const y = 34821223, w = 2310721022;
		function b(e) {
			return "0x" + (e >>> 0).toString(16).padStart(8, "0");
		}
		function _() {
			if (!d) {
				var e = ce();
				0 == e && (e += 4);
				var t, r = A[e >> 2], n = A[e + 4 >> 2];
				r == y && n == w || x(`Stack overflow! Stack cookie has been overwritten at ${t = e, "0x" + (t >>>= 0).toString(16).padStart(8, "0")}, expected hex dwords ${b(w)} and ${b(y)}, but received ${b(n)} ${b(r)}`), 1668509029 != A[0] && x("Runtime error: The application has corrupted its heap memory area (address zero)!");
			}
		}
		var m, g, v, A, D = !1;
		function S() {
			if (!v?.buffer?.resizable) {
				var e = pe.buffer;
				v = new Int8Array(e), t.HEAPU8 = R = new Uint8Array(e), g = new Int32Array(e), t.HEAPU32 = A = new Uint32Array(e), Q = new Float32Array(e), W = new Float64Array(e), O = new BigInt64Array(e);
			}
		}
		function x(e) {
			throw t.onAbort?.(e), f(e = `Aborted(${e})`), d = !0, e += ". Build with -sASSERTIONS for more info.", new WebAssembly.RuntimeError(e);
		}
		function k() {
			return t.locateFile ? s + "DiabloSpawn.wasm" : new URL("DiabloSpawn.wasm", "" + self.location.href).href;
		}
		function T(e, t) {
			var r, n = function(e) {
				if (e == m && c) return new Uint8Array(c);
				if (a) return a(e);
				throw "sync fetching of the wasm failed: you can preload it to Module[\"wasmBinary\"] manually, or emcc.py will do that for you when generating HTML (but not JS)";
			}(e);
			return r = new WebAssembly.Module(n), [new WebAssembly.Instance(r, t), r];
		}
		class C {
			name = "ExitStatus";
			constructor(e) {
				this.message = `Program terminated with exit(${e})`, this.status = e;
			}
		}
		var E = (e) => {
			for (; e.length > 0;) e.shift()(t);
		}, I = [], L = [], P = !0;
		var R, U = globalThis.TextDecoder && new TextDecoder(), M = (e, t = 0, r, n) => {
			var a = ((e, t, r, n) => {
				var a = t + r;
				if (n) return a;
				for (; e[t] && !(t >= a);) ++t;
				return t;
			})(e, t, r, n);
			if (a - t > 16 && e.buffer && U) return U.decode(e.subarray(t, a));
			for (var o = ""; t < a;) {
				var i = e[t++];
				if (128 & i) {
					var s = 63 & e[t++];
					if (192 != (224 & i)) {
						var c = 63 & e[t++];
						if ((i = 224 == (240 & i) ? (15 & i) << 12 | s << 6 | c : (7 & i) << 18 | s << 12 | c << 6 | 63 & e[t++]) < 65536) o += String.fromCharCode(i);
						else {
							var u = i - 65536;
							o += String.fromCharCode(55296 | u >> 10, 56320 | 1023 & u);
						}
					} else o += String.fromCharCode((31 & i) << 6 | s);
				} else o += String.fromCharCode(i);
			}
			return o;
		}, $ = (e, t, r) => e ? M(R, e, t, r) : "", B = null;
		class N {
			constructor(e) {
				this.excPtr = e, this.ptr = e - 24;
			}
			set_type(e) {
				A[this.ptr + 4 >> 2] = e;
			}
			get_type() {
				return A[this.ptr + 4 >> 2];
			}
			set_destructor(e) {
				A[this.ptr + 8 >> 2] = e;
			}
			get_destructor() {
				return A[this.ptr + 8 >> 2];
			}
			set_caught(e) {
				e = e ? 1 : 0, v[this.ptr + 12] = e;
			}
			get_caught() {
				return 0 != v[this.ptr + 12];
			}
			set_rethrown(e) {
				e = e ? 1 : 0, v[this.ptr + 13] = e;
			}
			get_rethrown() {
				return 0 != v[this.ptr + 13];
			}
			init(e, t) {
				this.set_adjusted_ptr(0), this.set_type(e), this.set_destructor(t);
			}
			set_adjusted_ptr(e) {
				A[this.ptr + 16 >> 2] = e;
			}
			get_adjusted_ptr() {
				return A[this.ptr + 16 >> 2];
			}
		}
		var W, O, q = (e) => ie(e), j = 0, z = {}, H = (e) => {
			if (e instanceof C || "unwind" == e) return u;
			_(), e instanceof WebAssembly.RuntimeError && le() <= 0 && f("Stack overflow detected.  You can try increasing -sSTACK_SIZE (currently set to 65536)"), o(0, e);
		}, F = () => P || j > 0, G = (e) => {
			u = e, F() || (d = !0), o(0, new C(e));
		}, K = (e, t) => {
			u = e, G(e);
		}, J = (e) => {
			if (!d) try {
				return e();
			} catch (t) {
				H(t);
			} finally {
				(() => {
					if (!F()) try {
						K(u);
					} catch (t) {
						H(t);
					}
				})();
			}
		}, X = [], Y = (e, t, r) => {
			var n = ((e, t) => {
				var r;
				for (X.length = 0; r = R[e++];) {
					var n = 105 != r;
					t += (n &= 112 != r) && t % 8 ? 4 : 0, X.push(112 == r ? A[t >> 2] : 106 == r ? O[t >> 3] : 105 == r ? g[t >> 2] : W[t >> 3]), t += n ? 8 : 4;
				}
				return X;
			})(t, r);
			return ye[e](...n);
		}, Z = (e, t) => Math.ceil(e / t) * t, V = (e) => {
			var t = (e - pe.buffer.byteLength + 65535) / 65536 | 0;
			try {
				return pe.grow(t), S(), 1;
			} catch (r) {}
		};
		var Q, ee = [
			null,
			[],
			[]
		], te = (e, t) => {
			var r = ee[e];
			t && 10 !== t ? r.push(t) : ((1 === e ? l : f)(M(r)), r.length = 0);
		}, re = [];
		t.noExitRuntime && (P = t.noExitRuntime), t.print && (l = t.print), t.printErr && (f = t.printErr), t.wasmBinary && (c = t.wasmBinary), t.arguments && t.arguments, t.thisProgram && t.thisProgram;
		var ne = t.preInit;
		if (ne) for ("function" == typeof ne && (t.preInit = ne = [ne]); ne.length > 0;) ne.shift()();
		var ae, oe, ie, se, ce, ue, le, fe, de, pe, he, ye = { 265598: (e) => {
			self.DApi.current_save_id(e);
		} };
		var we = {
			K: (e, t, r, n) => x(`Assertion failed: ${$(e)}, at: ` + [
				t ? $(t) : "unknown filename",
				r,
				n ? $(n) : "unknown function"
			]),
			w: () => ((e) => {
				var t = B?.excPtr;
				if (!t) return q(0), 0;
				var r = new N(t);
				r.set_adjusted_ptr(t);
				var n = r.get_type();
				if (!n) return q(0), t;
				for (var a of e) {
					if (!a || a === n) break;
					var o = r.ptr + 16;
					if (de(a, n, o)) return q(a), t;
				}
				return q(n), t;
			})([]),
			e: (e, t, r) => {
				throw new N(e).init(t, r), fe(e), B = new h(e), B;
			},
			v: (e) => {
				throw B || (B = new h(e)), B;
			},
			G: () => x(""),
			r: function() {
				self.DApi.close_keyboard();
			},
			f: function(e, t, r, n, a) {
				self.DApi.open_keyboard(e, t, r, n, a);
			},
			B: () => {
				P = !1, j = 0;
			},
			y: (e, t) => (z[e] && (clearTimeout(z[e].id), delete z[e]), t ? (z[e] = {
				id: setTimeout(() => {
					delete z[e], J(() => ae(e, performance.now()));
				}, t),
				timeout_ms: t
			}, 0) : 0),
			I: function(e, t, r) {
				self.DApi.create_sound(e, R.slice(t, t + r));
			},
			J: function(e, t, r, n, a) {
				self.DApi.create_sound_raw(e, Q.slice(t / 4, t / 4 + r * n), r, n, a);
			},
			a: function(e) {
				self.DApi.delete_sound(e);
			},
			j: function() {
				self.DApi.draw_begin();
			},
			t: function(e) {
				self.DApi.draw_belt(g.subarray(e / 4, e / 4 + 8));
			},
			g: function(e, t, r, n, a) {
				self.DApi.draw_blit(e, t, r, n, R.subarray(a, a + r * n * 4));
			},
			u: function(e, t, r, n) {
				self.DApi.draw_clip_text(e, t, r, n);
			},
			i: function() {
				self.DApi.draw_end();
			},
			m: function(e, t, r, n) {
				var a = R.indexOf(0, r), o = String.fromCharCode.apply(null, R.subarray(r, a));
				self.DApi.draw_text(e, t, o, n);
			},
			H: function(e, t) {
				self.DApi.duplicate_sound(e, t);
			},
			N: function() {
				self.DApi.exit_game();
			},
			o: function(e, t, r, n) {
				self.DApi.play_sound(e, t, r, n);
			},
			d: function(e, t) {
				self.DApi.set_cursor(e, t);
			},
			n: function(e, t) {
				self.DApi.set_volume(e, t);
			},
			b: function(e) {
				self.DApi.stop_sound(e);
			},
			k: function(e) {
				self.DApi.use_websocket(e);
			},
			L: function() {
				return self.DApi.websocket_closed();
			},
			M: function(e, t) {
				self.DApi.websocket_send(R.subarray(e, e + t));
			},
			l: (e, t, r) => Y(e, t, r),
			F: () => Date.now(),
			z: (e) => {
				var t = R.length, r = 2147483648;
				if ((e >>>= 0) > r) return !1;
				for (var n = 1; n <= 4; n *= 2) {
					var a = t * (1 + .2 / n);
					if (a = Math.min(a, e + 100663296), V(Math.min(r, Z(Math.max(e, a), 65536)))) return !0;
				}
				return !1;
			},
			c: K,
			s: function(e) {
				var t = R.indexOf(0, e), r = String.fromCharCode.apply(null, R.subarray(e, t));
				self.DApi.exit_error(r);
			},
			D: (e) => 52,
			C: function(e, t, r, n) {
				var a;
				return t = (a = t) < -9007199254740992 || a > 9007199254740992 ? NaN : Number(a), 70;
			},
			E: (e, t, r, n) => {
				for (var a = 0, o = 0; o < r; o++) {
					var i = A[t >> 2], s = A[t + 4 >> 2];
					t += 8;
					for (var c = 0; c < s; c++) te(e, R[i + c]);
					a += s;
				}
				return A[n >> 2] = a, 0;
			},
			h: function(e, t, r, n) {
				var a = R.indexOf(0, e), o = String.fromCharCode.apply(null, R.subarray(e, a));
				self.DApi.get_file_contents(o, R.subarray(t, t + n), r);
			},
			q: function(e) {
				var t = R.indexOf(0, e), r = String.fromCharCode.apply(null, R.subarray(e, t));
				return self.DApi.get_file_size(r);
			},
			x: function(e, t) {
				var r = le();
				try {
					return ((a = re[n = e]) || (re[n] = a = he.get(n)), a)(t);
				} catch (o) {
					if (ue(r), !(o instanceof p)) throw o;
					oe(1, 0);
				}
				var n, a;
			},
			A: G,
			p: function(e, t, r) {
				var n = R.indexOf(0, e), a = String.fromCharCode.apply(null, R.subarray(e, n));
				self.DApi.put_file_contents(a, R.slice(t, t + r));
			},
			O: function(e) {
				var t = R.indexOf(0, e), r = String.fromCharCode.apply(null, R.subarray(e, t));
				self.DApi.remove_file(r);
			}
		};
		function be() {
			var e;
			se(), 0 == (e = ce()) && (e += 4), A[e >> 2] = y, A[e + 4 >> 2] = w, A[0] = 1668509029;
		}
		var _e, me, ge = (me = { a: we }, m ??= k(), _e = T(m, me)[0], function(e) {
			t._DApi_SyncTextPtr = e.R, t._DApi_Init = e.S, t._DApi_Mouse = e.T, t._DApi_Key = e.U, t._DApi_Char = e.V, t._DApi_Render = e.W, t._DApi_SyncText = e.X, t._DApi_AllocPacket = e.Y, t._SNet_InitWebsocket = e.Z, t._SNet_WebsocketStatus = e._, ae = e.aa, oe = e.ba, ie = e.ca, se = e.da, ce = e.ea, ue = e.fa, le = e.ga, fe = e.ha, de = e.ia, e.ja, pe = e.P, he = e.$;
		}(ge = _e.exports), S(), ge);
		return await async function() {
			be(), function() {
				var e = t.preRun;
				e && ("function" == typeof e && (e = [e]), L.push(...e)), E(L);
			}();
			var e = t.setStatus;
			e && (e("Running..."), await new Promise((e) => setTimeout(e, 1)), setTimeout(e, 1, "")), d || (D = !0, _(), ge.Q(), _(), t.onRuntimeInitialized?.(), function() {
				_();
				var e = t.postRun;
				e && ("function" == typeof e && (e = [e]), I.push(...e)), E(I);
			}());
		}(), t.ready = new Promise(function(e, r) {
			delete t.then, t.onAbort = function(e) {
				r(e);
			};
			const n = function() {
				e(t);
			};
			var a;
			D ? n() : (a = n, I.push(a));
		}), t;
	}
	function r(e, t, r) {
		let n = null, a = [], o = 0, i = null, s = !1, c = !1;
		const u = (e) => {
			s || (s = !0, r(e));
		}, l = () => {
			if (i = null, !n || !a || !a.length) return;
			const e = a.reduce((e, t) => e + t.byteLength, 3), t = new Uint8Array(e);
			t[0] = 0, t[1] = 255 & a.length, t[2] = a.length >> 8;
			let r = 3;
			for (const n of a) t.set(n, r), r += n.byteLength;
			n.send(t), a.length = 0, o = 0;
		}, f = () => {
			n && a && !i && (i = setTimeout(l, 20));
		};
		return async function(e, t) {
			const r = new WebSocket(e);
			r.binaryType = "arraybuffer";
			let n = null;
			r.addEventListener("message", ({ data: e }) => {
				n ? n(e) : t(e);
			});
			const a = () => {
				try {
					r.close();
				} catch {}
			};
			await new Promise((e, t) => {
				const n = setTimeout(() => {
					r.removeEventListener("error", o), a(), t(1);
				}, 15e3), o = () => {
					clearTimeout(n), a(), t(1);
				};
				r.addEventListener("error", o), r.addEventListener("open", () => {
					clearTimeout(n), r.removeEventListener("error", o), e();
				});
			}), await new Promise((e, t) => {
				const r = setTimeout(() => {
					n = null, a(), t(1);
				}, 5e3);
				n = (o) => {
					clearTimeout(r);
					const i = new Uint8Array(o);
					50 === i[0] && (n = null, 1 == (i[1] | i[2] << 8 | i[3] << 16 | i[4] << 24) ? e() : (a(), t(2)));
				};
			});
			const o = "1.6.8".match(/(\d+)\.(\d+)\.(\d+)/), i = /* @__PURE__ */ new Uint8Array(5);
			return i[0] = 49, i[1] = parseInt(o[3]), i[2] = parseInt(o[2]), i[3] = parseInt(o[1]), i[4] = 0, r.send(i), r;
		}(e, t).then((e) => {
			n = e, a ? f() : n.close(), u(0);
		}, (e) => {
			a = null, o = 0, u(e);
		}), {
			get readyState() {
				return n ? n.readyState : 0;
			},
			send(e) {
				if (!a) return;
				const t = new Uint8Array(e);
				((e) => !(!n || n.readyState !== WebSocket.OPEN || 2 !== e[0] || (i && (clearTimeout(i), i = null), l(), n.send(e), 0)))(t) || (a.push(t), o += t.byteLength, a.length > 256 || o > 14680064 ? ((e) => {
					c || (c = !0, console.warn(`[ws-client] outbox overflow: ${e}`, {
						messages: a?.length ?? 0,
						bytes: o
					})), i && (clearTimeout(i), i = null), a = null, o = 0;
					try {
						n?.close(1009, "outbox overflow");
					} catch {}
					u(1);
				})("pending messages exceeded limits") : f());
			},
			close() {
				i && (clearTimeout(i), i = null), a = null, o = 0, n && n.close();
			}
		};
	}
	const n = (e) => "number" == typeof e && Number.isFinite(e), a = (e) => "string" == typeof e, o = (e) => a(e) || n(e), i = [
		"init",
		"event",
		"packet",
		"packetBatch",
		"quiesce"
	];
	function s(e) {
		if (!function(e, t) {
			return null !== (r = e) && "object" == typeof r && 1 === e.v && a(e.type) && t.includes(e.type) && e.action === e.type;
			var r;
		}(e, i)) return !1;
		switch (e.action) {
			case "quiesce": return n(e.requestId);
			case "init": return e.files instanceof Map && (null === e.mpq || e.mpq instanceof File) && "boolean" == typeof e.spawn && "boolean" == typeof e.offscreen;
			case "event": return a(e.func) && Array.isArray(e.params) && e.params.every(o);
			case "packet": return (t = e.buffer) instanceof ArrayBuffer || t instanceof Uint8Array;
			case "packetBatch": return Array.isArray(e.batch) && e.batch.every((e) => e instanceof ArrayBuffer);
			default: return !1;
		}
		var t;
	}
	const c = (e) => /\.sv$/i.test(e), u = function() {
		const e = globalThis.location, t = e?.hostname, r = e?.protocol;
		{
			if (((e) => "localhost" === e || "127.0.0.1" === e || "::1" === e)(t)) return "ws://127.0.0.1:8787/ws";
			const e = "VITE_WS_URL is required in production build";
			throw ((e, t) => {
				t ? console.error(`[ws-config] ${e}`, t) : console.error(`[ws-config] ${e}`);
			})(e, {
				mode: "production",
				hostname: t,
				protocol: r
			}), /* @__PURE__ */ new Error(e);
		}
	}(), l = self, f = (e) => ({
		...e,
		v: 1,
		type: e.action
	}), d = (e, t) => {
		t ? l.postMessage(e, t) : l.postMessage(e);
	};
	let p, h = null, y = null, w = null, b = null, _ = null, m = null, g = !1, v = null, A = !1;
	function D(e, t = "error") {
		e instanceof Error ? d(f({
			action: t,
			error: e.toString(),
			stack: e.stack
		})) : d(f({
			action: t,
			error: e?.toString?.() ?? String(e)
		}));
	}
	const S = {
		exit_error(e) {
			throw Error(e);
		},
		exit_game() {
			d(f({ action: "exit" }));
		},
		current_save_id(e) {
			d(f({
				action: "current_save",
				name: e >= 0 ? g ? `spawn${e}.sv` : `single_${e}.sv` : null
			}));
		},
		get_file_size(e) {
			const t = b?.get(e.toLowerCase());
			return t ? t.byteLength : 0;
		},
		get_file_contents(e, t, r) {
			const n = b?.get(e.toLowerCase());
			n && (n instanceof Uint8Array ? t.set(n.subarray(r, r + t.byteLength)) : n.readInto(t, r));
		},
		put_file_contents(e, t) {
			e = e.toLowerCase();
			const r = t.slice();
			b?.set(e, r), d(f({
				action: "fs",
				func: "update",
				params: [e, r]
			}));
		},
		remove_file(e) {
			e = e.toLowerCase(), b?.delete(e), d(f({
				action: "fs",
				func: "delete",
				params: [e]
			}));
		},
		set_cursor(e, t) {
			d(f({
				action: "cursor",
				x: e,
				y: t
			}));
		},
		open_keyboard(...e) {
			d(f({
				action: "keyboard",
				rect: [...e]
			}));
		},
		close_keyboard() {
			d(f({
				action: "keyboard",
				rect: null
			}));
		},
		use_websocket(e) {
			if (e) if (v && 1 === v.readyState) U("SNet_WebsocketStatus", 0);
			else {
				const e = v = r(u, (t) => {
					v === e && R(() => {
						const e = t, r = P._DApi_AllocPacket(e.byteLength);
						P.HEAPU8.set(new Uint8Array(e), r);
					});
				}, (e) => {
					if ("number" != typeof e) throw e;
					U("SNet_WebsocketStatus", e);
				});
			}
			else v && v.close(), v = null;
		},
		websocket_closed: () => !!v && 1 !== v.readyState
	}, x = {
		draw_begin() {
			_ = {
				images: [],
				text: [],
				clip: null,
				belt: m
			}, m = null;
		},
		draw_blit(e, t, r, n, a) {
			_?.images.push({
				x: e,
				y: t,
				w: r,
				h: n,
				data: a.slice()
			});
		},
		draw_clip_text(e, t, r, n) {
			_.clip = {
				x0: e,
				y0: t,
				x1: r,
				y1: n
			};
		},
		draw_text(e, t, r, n) {
			_?.text.push({
				x: e,
				y: t,
				text: r,
				color: n
			});
		},
		draw_end() {
			const e = _?.images.map(({ data: e }) => e.buffer) ?? [];
			_?.belt && e.push(_.belt.buffer), d(f({
				action: "render",
				batch: _
			}), e), _ = null;
		},
		draw_belt(e) {
			m = e.slice();
		}
	}, k = {
		draw_begin() {
			y && (y.save(), y.font = "bold 13px Times New Roman");
		},
		draw_blit(e, t, r, n, a) {
			y && w && (w.data.set(a), y.putImageData(w, e, t));
		},
		draw_clip_text(e, t, r, n) {
			y && (y.beginPath(), y.rect(e, t, r - e, n - t), y.clip());
		},
		draw_text(e, t, r, n) {
			if (y) {
				const a = n >> 16 & 255, o = n >> 8 & 255, i = 255 & n;
				y.fillStyle = `rgb(${a}, ${o}, ${i})`, y.fillText(r, e, t + 22);
			}
		},
		draw_end() {
			if (y && h) {
				y.restore();
				const e = h.transferToImageBitmap(), t = [e];
				m && t.push(m.buffer), d(f({
					action: "render",
					batch: {
						bitmap: e,
						belt: m
					}
				}), t), m = null;
			}
		},
		draw_belt(e) {
			m = e.slice();
		}
	};
	let T = null, C = null, E = 0, I = 0;
	[
		"create_sound_raw",
		"create_sound",
		"duplicate_sound"
	].forEach((e) => {
		S[e] = function(...t) {
			if (T) I = t[0] + 1, T.push({
				func: e,
				params: t
			}), "duplicate_sound" !== e && C.push(t[1].buffer);
			else {
				E = t[0] + 1;
				const r = [];
				"duplicate_sound" !== e && r.push(t[1].buffer), d(f({
					action: "audio",
					func: e,
					params: t
				}), r);
			}
		};
	}), [
		"play_sound",
		"set_volume",
		"stop_sound",
		"delete_sound"
	].forEach((e) => {
		S[e] = function(...t) {
			T && t[0] >= E ? T.push({
				func: e,
				params: t
			}) : d(f({
				action: "audio",
				func: e,
				params: t
			}));
		};
	});
	let L = null;
	S.websocket_send = function(e) {
		v ? v.send(e) : L ? L.push(e.slice().buffer) : d(f({
			action: "packet",
			buffer: e
		}));
	}, l.DApi = S;
	let P = null;
	function R(e) {
		if (!A) try {
			e();
		} catch (t) {
			D(t);
		}
	}
	function U(e, ...t) {
		R(() => {
			const r = null != T;
			if (r || (T = [], C = [], L = []), "text" !== e) P["_" + e](...t);
			else {
				const e = P._DApi_SyncTextPtr(), r = t[0], n = Math.min(r.length, 255), a = P.HEAPU8;
				for (let t = 0; t < n; ++t) a[e + t] = r.charCodeAt(t);
				a[e + n] = 0, P._DApi_SyncText(t[1]);
			}
			r || (T.length && (E = I, d(f({
				action: "audioBatch",
				batch: T
			}), C)), L.length && d(f({
				action: "packetBatch",
				batch: L
			}), L), T = null, C = null, L = null);
		});
	}
	const M = (e, t, r) => {
		d(f({
			action: "progress",
			text: e,
			loaded: t,
			total: r
		}));
	}, $ = (e, t) => function(e, t) {
		return new Promise((r, n) => {
			const a = new FileReader();
			a.onload = () => r(a.result), a.onerror = () => n(a.error), a.onabort = () => n(), t && a.addEventListener("progress", t), a.readAsArrayBuffer(e);
		});
	}(e, t).then((r) => (t?.({ loaded: e.size }), r));
	async function B(r, n) {
		const a = await async function(e, t, r) {
			const n = await fetch(e, r);
			if (!n.ok) throw new Error(`${n.status} ${n.statusText}`);
			const a = Number(n.headers.get("content-length") ?? 0), o = n.body?.getReader();
			if (!o) throw new Error("Response body is null");
			const i = [];
			let s = 0;
			for (;;) {
				const { done: e, value: r } = await o.read();
				if (e) break;
				r && (i.push(r), s += r.length, t?.(s, a));
			}
			const c = new Uint8Array(s);
			let u = 0;
			for (const l of i) c.set(l, u), u += l.length;
			return c.buffer;
		}(r ? "/diablo/assets/diabloSpawn-C9ivkBl9.wasm" : "/diablo/assets/diablo-BJaineoj.wasm", (e, t) => n({
			loaded: e,
			total: t
		})), o = await async function(e, t) {
			const r = e(t);
			return r instanceof Promise ? r : r.ready;
		}(r ? t : e, { wasmBinary: a });
		return n({ loaded: 2e6 }), o;
	}
	async function N(e, t, r) {
		if (g = t, r ? (h = new OffscreenCanvas(640, 480), y = h.getContext("2d"), w = y.createImageData(640, 480), Object.assign(S, k)) : Object.assign(S, x), !e) {
			const e = t ? "spawn.mpq" : "diabdat.mpq";
			if (!b.has(e)) {
				const t = "/diablo/".endsWith("/") ? "/diablo/".slice(0, -1) : "/diablo/";
				b.set(e, await async function(e) {
					const t = await fetch(e);
					if (!t.ok) throw new Error(`Failed to load remote file: ${t.status}`);
					const r = [];
					let n = 0;
					const a = t.body?.getReader();
					try {
						if (Number(t.headers.get("Content-Length") || 0) > 1073741824) throw new Error("Remote file is too large");
						if (!a) throw new Error("Remote file response has no body");
						for (;;) {
							const { done: e, value: t } = await a.read();
							if (e) break;
							if (n + t.byteLength > 1073741824) throw new Error("Remote file is too large");
							t.byteLength && r.push({
								offset: n,
								bytes: t
							}), n += t.byteLength;
						}
					} catch (o) {
						throw a ? await a.cancel().catch(() => {}) : await t.body?.cancel().catch(() => {}), o;
					} finally {
						a?.releaseLock();
					}
					return {
						byteLength: n,
						readInto(e, t) {
							if (t < 0 || !Number.isSafeInteger(t)) throw new RangeError("Invalid archive offset");
							let a = 0, o = r.length;
							for (; a < o;) {
								const e = a + o >>> 1, n = r[e];
								n.offset + n.bytes.byteLength <= t ? a = e + 1 : o = e;
							}
							const i = Math.min(n, t + e.byteLength);
							for (let n = a; n < r.length && r[n].offset < i; n++) {
								const { offset: a, bytes: o } = r[n], s = Math.max(t, a), c = Math.min(i, a + o.byteLength);
								e.set(o.subarray(s - a, c - a), s - t);
							}
						}
					};
				}(`${t}/${e}`));
			}
		}
		M("Loading...");
		let n = 0;
		const a = e ? e.size : 0;
		let o = 0;
		const i = t ? 1215907 : 1364619;
		function s() {
			M("Loading...", n + 5 * o, a + 5 * i);
		}
		const c = B(t, (e) => {
			o = Math.min(e.loaded, i), s();
		}), u = e ? $(e, (e) => {
			const t = e;
			n = t.loaded ?? t.loadedBytes ?? n, s();
		}) : Promise.resolve(null), [l, f] = await Promise.all([c, u]);
		if (A) return;
		P = l, f && b.set(t ? "spawn.mpq" : "diabdat.mpq", new Uint8Array(f)), M("Initializing...");
		const d = "1.6.8".match(/(\d+)\.(\d+)\.(\d+)/);
		P._SNet_InitWebsocket(), P._DApi_Init(Math.floor(performance.now()), r ? 1 : 0, parseInt(d[1]), parseInt(d[2]), parseInt(d[3])), p = setInterval(() => {
			U("DApi_Render", Math.floor(performance.now()));
		}, 50);
	}
	l.addEventListener("message", ({ data: e }) => {
		if (s(e)) switch (e.action) {
			case "quiesce": {
				A = !0, clearInterval(p);
				const t = /* @__PURE__ */ new Map();
				for (const [e, r] of b ?? []) c(e) && r instanceof Uint8Array && t.set(e, r.slice());
				d(f({
					action: "quiesced",
					requestId: e.requestId,
					saves: t
				}));
				break;
			}
			case "init":
				b = e.files, N(e.mpq, e.spawn, e.offscreen).then(() => d(f({ action: "loaded" })), (e) => D(e, "failed"));
				break;
			case "event":
				U(e.func, ...e.params);
				break;
			case "packet":
				R(() => {
					const t = P._DApi_AllocPacket(e.buffer.byteLength);
					P.HEAPU8.set(new Uint8Array(e.buffer), t);
				});
				break;
			case "packetBatch": R(() => {
				for (const t of e.batch) {
					const e = P._DApi_AllocPacket(t.byteLength);
					P.HEAPU8.set(new Uint8Array(t), e);
				}
			});
		}
		else D(/* @__PURE__ */ new Error("Main thread protocol mismatch."));
	});
})();
