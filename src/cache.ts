import { EditorSelection, TFile } from "obsidian";

export interface VolatileCache {
	sublistMarkedRegion?: EditorSelection;
	sublistMarkedFile?: TFile | null;
	sublistMarkedTime?: number;
}
