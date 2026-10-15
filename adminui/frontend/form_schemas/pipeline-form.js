// /form_schemas/pipeline-form.js

/* -------------------------------- schema -------------------------------- */

export const pipelineSchema = {
	type: "object",
	required: ["pipelineName", "table", "description", "matchField", "columns"],

	properties: {
		pipelineName: { type: "string", title: "Pipeline Name", minLength: 1 },

		// table oneOf should be populated by api.
		table: {
			type: "string",
			title: "Table",
			oneOf: [
				{ const: "def_interface", title: "Interface" },
				{ const: "meta_interface", title: "Interface metadata" },
			],
		},

		description: { type: "string", title: "Description", minLength: 1 },

		// match_field oneOf should be populated by api.
		matchField: {
			type: "string",
			title: "Match Field",
			description:
				"The field in each raw record that rules are matched against, e.g. protocol.",
			oneOf: [
				{ const: "protocol", title: "protocol" },
				{ const: "source", title: "source" },
			],
		},

		columns: {
			type: "array",
			title: "Transformer Columns",
			minItems: 1,

			items: {
				type: "object",
				required: ["targetColumn", "matchValue", "operation"],

				properties: {
					targetColumn: { type: "string", title: "Column" },

					// Display-only copy of the root matchField, shown as the chip in the IF row.
					// Not part of the API payload.
					matchFieldMirror: { type: "string", title: "Match Field", readOnly: true },

					matchValue: { type: "string", title: "Value" },

					// Switch that reveals the optional vendor condition row.
					// Accepts true or the native checkbox string "on".
					hasVendorCondition: { type: ["boolean", "string"], title: "Vendor Condition" },
					vendorMatchField: { type: "string", title: "Vendor Field", minLength: 1 },
					vendorMatchValue: { type: "string", title: "Vendor Value", minLength: 1 },

					operation: {
						type: "string",
						title: "Operation",
						oneOf: [
							{ const: "field", title: "Copy field" },
							{ const: "static", title: "Static value" },
							{ const: "concat", title: "Concatenate fields" },
							{ const: "regex_extract", title: "Extract with regex" },
							{ const: "regex_replace", title: "Replace with regex" },
							{ const: "translate", title: "Map values" },
							{ const: "postfix", title: "Calculate (postfix)" },
							{ const: "cache_lookup", title: "Cache lookup" },
						],
					},

					// Union of every key any operation can use.
					// Which keys are required is enforced by `allOf` below.
					config: {
						type: "object",
						title: "Config",
						properties: {
							source: { type: "string", title: "Source" },
							field: { type: "string", title: "Field" },
							value: { type: "string", title: "Value" },

							// List of text. minItems/maxItems drive the native array renderer.
							fields: {
								type: "array",
								title: "Fields",
								minItems: 1,
								maxItems: 10,
								items: { type: "string", title: "Field" },
							},

							delimiter: { type: "string", title: "Delimiter" },
							regex: { type: "string", title: "Regex" },
							group: { type: "integer", title: "Group", minimum: 0 },
							replacement: { type: "string", title: "Replacement" },

							// Key -> value pairs, stored as a list of { key, value }.
							map: {
								type: "array",
								title: "Map",
								minItems: 1,
								maxItems: 50,
								items: {
									type: "object",
									properties: {
										key: { type: "string", title: "Key" },
										value: { type: "string", title: "Value" },
									},
								},
							},

							default: { type: "string", title: "Default" },
							expression: { type: "string", title: "Expression" },
							metadata_type: { type: "string", title: "Metadata Type" },
							key: { type: "string", title: "Key" },
							location: { type: "string", title: "Location" },
							on_miss: {
								type: "string",
								title: "On Miss",
								oneOf: [
									{ const: "null", title: "Null" },
									{ const: "skip", title: "Skip" },
									{ const: "fail", title: "Fail" },
								],
							},
							cast: { type: "string", title: "Cast" },
						},
					},

					// Switch that reveals the optional ELSE row
					hasDefaultValue: { type: ["boolean", "string"], title: "Default Value" },
					defaultValue: { type: "string", title: "Default Value", minLength: 1 },
				},

				// Conditional requirements. Kept inside if/then so hidden or stale
				// values from a previously selected operation can never block validation.
				allOf: [
					// Switches
					{
						if: {
							properties: { hasVendorCondition: { enum: [true, "on"] } },
							required: ["hasVendorCondition"],
						},
						then: { required: ["vendorMatchField", "vendorMatchValue"] },
					},
					{
						if: {
							properties: { hasDefaultValue: { enum: [true, "on"] } },
							required: ["hasDefaultValue"],
						},
						then: { required: ["defaultValue"] },
					},

					// Operations (everything except cast is required)

					// field: source
					{
						if: {
							properties: { operation: { const: "field" } },
							required: ["operation"],
						},
						then: {
							required: ["config"],
							properties: {
								config: {
									required: ["source"],
									properties: { source: { minLength: 1 } },
								},
							},
						},
					},

					// static: value
					{
						if: {
							properties: { operation: { const: "static" } },
							required: ["operation"],
						},
						then: {
							required: ["config"],
							properties: {
								config: {
									required: ["value"],
									properties: { value: { minLength: 1 } },
								},
							},
						},
					},

					// concat: fields, delimiter
					{
						if: {
							properties: { operation: { const: "concat" } },
							required: ["operation"],
						},
						then: {
							required: ["config"],
							properties: {
								config: {
									required: ["fields", "delimiter"],
									properties: {
										fields: { items: { minItems: 1 } },
										delimiter: { minLength: 1 },
									},
								},
							},
						},
					},

					// regex_extract: source, regex, group
					{
						if: {
							properties: { operation: { const: "regex_extract" } },
							required: ["operation"],
						},
						then: {
							required: ["config"],
							properties: {
								config: {
									required: ["source", "regex", "group"],
									properties: {
										source: { minLength: 1 },
										regex: { minLength: 1 },
									},
								},
							},
						},
					},

					// regex_replace: source, regex, replacement
					{
						if: {
							properties: { operation: { const: "regex_replace" } },
							required: ["operation"],
						},
						then: {
							required: ["config"],
							properties: {
								config: {
									required: ["source", "regex", "replacement"],
									properties: {
										source: { minLength: 1 },
										regex: { minLength: 1 },
										replacement: { minLength: 1 },
									},
								},
							},
						},
					},

					// translate: source, map, default
					{
						if: {
							properties: { operation: { const: "translate" } },
							required: ["operation"],
						},
						then: {
							required: ["config"],
							properties: {
								config: {
									required: ["source", "map", "default"],
									properties: {
										source: { minLength: 1 },
										map: {
											items: {
												required: ["key", "value"],
												properties: {
													key: { minLength: 1 },
													value: { minLength: 1 },
												},
											},
										},
										default: { minLength: 1 },
									},
								},
							},
						},
					},

					// postfix: field, expression
					{
						if: {
							properties: { operation: { const: "postfix" } },
							required: ["operation"],
						},
						then: {
							required: ["config"],
							properties: {
								config: {
									required: ["field", "expression"],
									properties: {
										field: { minLength: 1 },
										expression: { minLength: 1 },
									},
								},
							},
						},
					},

					// cache_lookup: metadata_type, key, location, on_miss
					{
						if: {
							properties: { operation: { const: "cache_lookup" } },
							required: ["operation"],
						},
						then: {
							required: ["config"],
							properties: {
								config: {
									required: ["metadata_type", "key", "location", "on_miss"],
									properties: {
										metadata_type: { minLength: 1 },
										key: { minLength: 1 },
										location: { minLength: 1 },
									},
								},
							},
						},
					},
				],
			},
		},
	},
};

/* -------------------------------- ui schema ----------------------------- */

export const pipelineUiSchema = {
	type: "VerticalLayout",

	elements: [
		{
			type: "HorizontalLayout",
			elements: [
				{
					type: "Control",
					scope: "#/properties/pipelineName",
					customComponent: "pkts-input-text",
					options: { placeholder: "Enter Value", required: true },
				},
				{
					type: "Control",
					scope: "#/properties/table",
					customComponent: "pkts-select",
					options: { placeholder: "Select Option", required: true },
				},
			],
		},

		{
			type: "Control",
			scope: "#/properties/description",
			customComponent: "pkts-input-text",
			options: { placeholder: "Enter Value", required: true },
		},

		{
			type: "Control",
			scope: "#/properties/matchField",
			customComponent: "pkts-select",
			options: { placeholder: "Enter Value", info: true, required: true },
		},

		{
			type: "Control",
			scope: "#/properties/columns",
			options: {
				showSortButtons: true,
				elementLabelPrefix: "RULE",

				detail: {
					type: "VerticalLayout",
					elements: [
						// WRITE TO
						{
							type: "HorizontalLayout",
							elements: [
								{ type: "Label", text: "WRITE TO" },
								{
									type: "Control",
									scope: "#/properties/targetColumn",
									customComponent: "pkts-select",
									options: { placeholder: "target_column", required: true },
								},
							],
						},

						// IF <match field> = value   [switch: Vendor Condition]
						{
							type: "HorizontalLayout",
							elements: [
								{ type: "Label", text: "IF" },
								{
									// Read-only copy of the root matchField (the chip in the mockup)
									type: "Control",
									scope: "#/properties/matchFieldMirror",
									customComponent: "pkts-chip",
									options: { placeholder: "Null" },
								},
								{ type: "Label", text: "=" },
								{
									type: "Control",
									scope: "#/properties/matchValue",
									customComponent: "pkts-input-text",
									options: { placeholder: "match_value", required: true },
								},
								{
									type: "Control",
									scope: "#/properties/hasVendorCondition",
									customComponent: "pkts-input-switch",
									options: { label: "Vendor Condition" },
								},
							],
						},

						// AND vendor_field = vendor_value (only when the switch is on)
						{
							type: "HorizontalLayout",
							rule: {
								effect: "SHOW",
								condition: {
									scope: "#/properties/hasVendorCondition",
									schema: { enum: [true, "on"] },
									failWhenUndefined: true,
								},
							},
							elements: [
								{ type: "Label", text: "AND" },
								{
									type: "Control",
									scope: "#/properties/vendorMatchField",
									customComponent: "pkts-input-text",
									options: { placeholder: "vendor_match_field", required: true },
								},
								{ type: "Label", text: "=" },
								{
									type: "Control",
									scope: "#/properties/vendorMatchValue",
									customComponent: "pkts-input-text",
									options: { placeholder: "vendor_match_value", required: true },
								},
							],
						},

						// THEN: keyword | Operation | [ Config caption + bordered body ]
						{
							type: "HorizontalLayout",
							options: { weights: [1, 5, 7] },
							elements: [
								{ type: "Label", text: "THEN" },

								// Left column: Operation only
								{
									type: "VerticalLayout",
									elements: [
										{
											type: "Control",
											scope: "#/properties/operation",
											customComponent: "pkts-select",
											options: {
												placeholder: "Select Operation",
												required: true,
											},
										},
									],
								},

								// Right column: two stacked items.
								//   item 1: "Config" caption (always visible)
								//   item 2: body, which gets the border-left in CSS
								{
									type: "VerticalLayout",
									elements: [
										// Item 1: caption
										{ type: "Label", text: "Config" },

										// Item 2: body (hint + one group per operation)
										{
											type: "VerticalLayout",
											elements: [
												// Hint shown until an operation is chosen
												{
													type: "VerticalLayout",
													rule: {
														effect: "HIDE",
														condition: {
															scope: "#/properties/operation",
															schema: {
																type: "string",
																minLength: 1,
															},
															failWhenUndefined: true,
														},
													},
													elements: [
														{
															type: "Label",
															text: "Choose an operation to set its config",
														},
													],
												},

												// field
												{
													type: "VerticalLayout",
													rule: {
														effect: "SHOW",
														condition: {
															scope: "#/properties/operation",
															schema: { const: "field" },
															failWhenUndefined: true,
														},
													},
													elements: [
														{
															type: "Control",
															scope: "#/properties/config/properties/source",
															customComponent: "pkts-input-text",
															options: {
																placeholder: "Enter Value",
																required: true,
															},
														},
														{
															type: "Control",
															scope: "#/properties/config/properties/cast",
															customComponent: "pkts-input-text",
															options: { placeholder: "Enter Value" },
														},
													],
												},

												// static
												{
													type: "VerticalLayout",
													rule: {
														effect: "SHOW",
														condition: {
															scope: "#/properties/operation",
															schema: { const: "static" },
															failWhenUndefined: true,
														},
													},
													elements: [
														{
															type: "Control",
															scope: "#/properties/config/properties/value",
															customComponent: "pkts-input-text",
															options: {
																placeholder: "Enter Value",
																required: true,
															},
														},
													],
												},

												// concat
												{
													type: "VerticalLayout",
													rule: {
														effect: "SHOW",
														condition: {
															scope: "#/properties/operation",
															schema: { const: "concat" },
															failWhenUndefined: true,
														},
													},
													elements: [
														{
															type: "Control",
															scope: "#/properties/config/properties/fields",
															options: {
																required: true,
																detail: {
																	type: "Control",
																	scope: "#",
																	customComponent:
																		"pkts-input-text",
																	options: {
																		placeholder: "Enter Value",
																		required: true,
																	},
																},
															},
														},
														{
															type: "Control",
															scope: "#/properties/config/properties/delimiter",
															customComponent: "pkts-input-text",
															options: {
																placeholder: "Enter Value",
																required: true,
															},
														},
													],
												},

												// regex_extract
												{
													type: "VerticalLayout",
													rule: {
														effect: "SHOW",
														condition: {
															scope: "#/properties/operation",
															schema: { const: "regex_extract" },
															failWhenUndefined: true,
														},
													},
													elements: [
														{
															type: "Control",
															scope: "#/properties/config/properties/source",
															customComponent: "pkts-input-text",
															options: {
																placeholder: "Enter Value",
																required: true,
															},
														},
														{
															type: "Control",
															scope: "#/properties/config/properties/regex",
															customComponent: "pkts-input-text",
															options: {
																placeholder: "Enter Value",
																required: true,
															},
														},
														{
															type: "Control",
															scope: "#/properties/config/properties/group",
															customComponent: "pkts-input-number",
															options: {
																placeholder: "Enter Value",
																required: true,
															},
														},
														{
															type: "Control",
															scope: "#/properties/config/properties/cast",
															customComponent: "pkts-input-text",
															options: { placeholder: "Enter Value" },
														},
													],
												},

												// regex_replace
												{
													type: "VerticalLayout",
													rule: {
														effect: "SHOW",
														condition: {
															scope: "#/properties/operation",
															schema: { const: "regex_replace" },
															failWhenUndefined: true,
														},
													},
													elements: [
														{
															type: "Control",
															scope: "#/properties/config/properties/source",
															customComponent: "pkts-input-text",
															options: {
																placeholder: "Enter Value",
																required: true,
															},
														},
														{
															type: "Control",
															scope: "#/properties/config/properties/regex",
															customComponent: "pkts-input-text",
															options: {
																placeholder: "Enter Value",
																required: true,
															},
														},
														{
															type: "Control",
															scope: "#/properties/config/properties/replacement",
															customComponent: "pkts-input-text",
															options: {
																placeholder: "Enter Value",
																required: true,
															},
														},
													],
												},

												// translate
												{
													type: "VerticalLayout",
													rule: {
														effect: "SHOW",
														condition: {
															scope: "#/properties/operation",
															schema: { const: "translate" },
															failWhenUndefined: true,
														},
													},
													elements: [
														{
															type: "Control",
															scope: "#/properties/config/properties/source",
															customComponent: "pkts-input-text",
															options: {
																placeholder: "Enter Value",
																required: true,
															},
														},
														{
															type: "Control",
															scope: "#/properties/config/properties/map",
															options: {
																required: true,
																detail: {
																	type: "HorizontalLayout",
																	elements: [
																		{
																			type: "Control",
																			scope: "#/properties/key",
																			customComponent:
																				"pkts-input-text",
																			options: {
																				placeholder: "Key",
																				required: true,
																			},
																		},
																		{
																			type: "Control",
																			scope: "#/properties/value",
																			customComponent:
																				"pkts-input-text",
																			options: {
																				placeholder:
																					"Value",
																				required: true,
																			},
																		},
																	],
																},
															},
														},
														{
															type: "Control",
															scope: "#/properties/config/properties/default",
															customComponent: "pkts-input-text",
															options: {
																placeholder: "Enter Value",
																required: true,
															},
														},
													],
												},

												// postfix
												{
													type: "VerticalLayout",
													rule: {
														effect: "SHOW",
														condition: {
															scope: "#/properties/operation",
															schema: { const: "postfix" },
															failWhenUndefined: true,
														},
													},
													elements: [
														{
															type: "Control",
															scope: "#/properties/config/properties/field",
															customComponent: "pkts-input-text",
															options: {
																placeholder: "Enter Value",
																required: true,
															},
														},
														{
															type: "Control",
															scope: "#/properties/config/properties/expression",
															customComponent: "pkts-input-text",
															options: {
																placeholder: "Enter Value",
																required: true,
															},
														},
														{
															type: "Control",
															scope: "#/properties/config/properties/cast",
															customComponent: "pkts-input-text",
															options: { placeholder: "Enter Value" },
														},
													],
												},

												// cache_lookup
												{
													type: "VerticalLayout",
													rule: {
														effect: "SHOW",
														condition: {
															scope: "#/properties/operation",
															schema: { const: "cache_lookup" },
															failWhenUndefined: true,
														},
													},
													elements: [
														{
															type: "Control",
															scope: "#/properties/config/properties/metadata_type",
															customComponent: "pkts-input-text",
															options: {
																placeholder: "Enter Value",
																required: true,
															},
														},
														{
															type: "Control",
															scope: "#/properties/config/properties/key",
															customComponent: "pkts-input-text",
															options: {
																placeholder: "Enter Value",
																required: true,
															},
														},
														{
															type: "Control",
															scope: "#/properties/config/properties/location",
															customComponent: "pkts-input-text",
															options: {
																placeholder: "Enter Value",
																required: true,
															},
														},
														{
															type: "Control",
															scope: "#/properties/config/properties/on_miss",
															customComponent: "pkts-select",
															options: {
																placeholder: "Select Option",
																required: true,
															},
														},
														{
															type: "Control",
															scope: "#/properties/config/properties/cast",
															customComponent: "pkts-input-text",
															options: { placeholder: "Enter Value" },
														},
													],
												},
											],
										},
									],
								},
							],
						},

						// Default Value switch: its own line
						{
							type: "HorizontalLayout",
							elements: [
								{
									type: "Control",
									scope: "#/properties/hasDefaultValue",
									customComponent: "pkts-input-switch",
									options: { label: "Default Value" },
								},

								// ELSE default_value (only when the switch is on)
								{
									type: "HorizontalLayout",
									rule: {
										effect: "SHOW",
										condition: {
											scope: "#/properties/hasDefaultValue",
											schema: { enum: [true, "on"] },
											failWhenUndefined: true,
										},
									},
									elements: [
										{ type: "Label", text: "ELSE" },
										{
											type: "Control",
											scope: "#/properties/defaultValue",
											customComponent: "pkts-input-text",
											options: {
												placeholder: "default_value",
												required: true,
											},
										},
									],
								},
							],
						},
					],
				},
			},
		},
	],
};

/* ------------------------------ initial data ---------------------------- */

// One empty rule is visible on load, since a transformer needs at least one column.
export const pipelineInitialData = {
	columns: [{}],
};

export default {
	schema: pipelineSchema,
	uiSchema: pipelineUiSchema,
	initialData: pipelineInitialData,
};
