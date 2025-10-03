import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';
export type ReqEx = RequestHandlerExtra<ServerRequest, ServerNotification>


export function getReqHeaders(req:ReqEx,needCsrfToken:boolean=false):[string,string]{
	let csrfToken = req.requestInfo?.headers["csrftoken"];
	let cookies = req.requestInfo?.headers["reqcookie"] ?? "";
	if (Array.isArray(cookies)) {
		cookies = cookies[0];
	}
	if (!needCsrfToken) {
		return [cookies , ""];
	}
	if (!csrfToken){
		throw new Error("MCP Server Error, Your Request must have headers with `csrfToken`.It cause by MCP client.")
	}
	if (Array.isArray(csrfToken)) {
		csrfToken = csrfToken[0];
	}
	return [cookies,csrfToken]
}

export function parseWikiUrl( wikiUrl: string ): string {
	const url = new URL( wikiUrl );
	return `${ url.protocol }//${ url.host }/`;
}
