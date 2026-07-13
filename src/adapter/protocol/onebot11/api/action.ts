/**
 * OneBot v11 action 名称到请求/响应类型的映射。
 */

import type {
  OneBotCanSendImageResponse,
  OneBotCanSendRecordResponse,
  OneBotDeleteMsgRequest,
  OneBotGetForwardMsgRequest,
  OneBotGetForwardMsgResponse,
  OneBotGetImageRequest,
  OneBotGetImageResponse,
  OneBotGetMsgRequest,
  OneBotGetMsgResponse,
  OneBotGetRecordRequest,
  OneBotGetRecordResponse,
  OneBotSendGroupMsgRequest,
  OneBotSendLikeRequest,
  OneBotSendMsgRequest,
  OneBotSendMsgResponse,
  OneBotSendPrivateMsgRequest,
} from "./message";
import type {
  OneBotFriendAddRequestHandleRequest,
  OneBotGetFriendListResponse,
  OneBotGetLoginInfoResponse,
  OneBotGetStrangerInfoRequest,
  OneBotGetStrangerInfoResponse,
} from "./account";
import type {
  OneBotGetGroupHonorInfoRequest,
  OneBotGetGroupHonorInfoResponse,
  OneBotGetGroupInfoResponse,
  OneBotGetGroupMemberInfoRequest,
  OneBotGetGroupMemberInfoResponse,
  OneBotGetGroupMemberListRequest,
  OneBotGetGroupMemberListResponse,
  OneBotGetGroupListResponse,
  OneBotGroupAddRequestHandleRequest,
  OneBotGroupInfoRequest,
  OneBotSetGroupAdminRequest,
  OneBotSetGroupAnonymousBanRequest,
  OneBotSetGroupAnonymousRequest,
  OneBotSetGroupBanRequest,
  OneBotSetGroupCardRequest,
  OneBotSetGroupKickRequest,
  OneBotSetGroupLeaveRequest,
  OneBotSetGroupNameRequest,
  OneBotSetGroupSpecialTitleRequest,
  OneBotSetGroupWholeBanRequest,
} from "./group";
import type {
  OneBotCleanCacheRequest,
  OneBotGetCookiesRequest,
  OneBotGetCookiesResponse,
  OneBotGetCredentialsRequest,
  OneBotGetCredentialsResponse,
  OneBotGetCsrfTokenResponse,
  OneBotGetStatusResponse,
  OneBotGetVersionInfoResponse,
  OneBotSetRestartRequest,
} from "./system";
import type { OneBotApiResponse, OneBotEmptyData } from "../common";

export interface OneBotActionMap {
  send_private_msg: [OneBotSendPrivateMsgRequest, OneBotSendMsgResponse];
  send_group_msg: [OneBotSendGroupMsgRequest, OneBotSendMsgResponse];
  send_msg: [OneBotSendMsgRequest, OneBotSendMsgResponse];
  delete_msg: [OneBotDeleteMsgRequest, OneBotApiResponse<OneBotEmptyData>];
  get_msg: [OneBotGetMsgRequest, OneBotGetMsgResponse];
  get_forward_msg: [OneBotGetForwardMsgRequest, OneBotGetForwardMsgResponse];
  send_like: [OneBotSendLikeRequest, OneBotApiResponse<OneBotEmptyData>];
  get_record: [OneBotGetRecordRequest, OneBotGetRecordResponse];
  get_image: [OneBotGetImageRequest, OneBotGetImageResponse];
  can_send_image: [OneBotEmptyData, OneBotCanSendImageResponse];
  can_send_record: [OneBotEmptyData, OneBotCanSendRecordResponse];

  set_group_kick: [OneBotSetGroupKickRequest, OneBotApiResponse<OneBotEmptyData>];
  set_group_ban: [OneBotSetGroupBanRequest, OneBotApiResponse<OneBotEmptyData>];
  set_group_anonymous_ban: [OneBotSetGroupAnonymousBanRequest, OneBotApiResponse<OneBotEmptyData>];
  set_group_whole_ban: [OneBotSetGroupWholeBanRequest, OneBotApiResponse<OneBotEmptyData>];
  set_group_admin: [OneBotSetGroupAdminRequest, OneBotApiResponse<OneBotEmptyData>];
  set_group_anonymous: [OneBotSetGroupAnonymousRequest, OneBotApiResponse<OneBotEmptyData>];
  set_group_card: [OneBotSetGroupCardRequest, OneBotApiResponse<OneBotEmptyData>];
  set_group_name: [OneBotSetGroupNameRequest, OneBotApiResponse<OneBotEmptyData>];
  set_group_leave: [OneBotSetGroupLeaveRequest, OneBotApiResponse<OneBotEmptyData>];
  set_group_special_title: [OneBotSetGroupSpecialTitleRequest, OneBotApiResponse<OneBotEmptyData>];
  get_group_info: [OneBotGroupInfoRequest, OneBotGetGroupInfoResponse];
  get_group_list: [OneBotEmptyData, OneBotGetGroupListResponse];
  get_group_member_info: [OneBotGetGroupMemberInfoRequest, OneBotGetGroupMemberInfoResponse];
  get_group_member_list: [OneBotGetGroupMemberListRequest, OneBotGetGroupMemberListResponse];
  get_group_honor_info: [OneBotGetGroupHonorInfoRequest, OneBotGetGroupHonorInfoResponse];

  get_login_info: [OneBotEmptyData, OneBotGetLoginInfoResponse];
  get_stranger_info: [OneBotGetStrangerInfoRequest, OneBotGetStrangerInfoResponse];
  get_friend_list: [OneBotEmptyData, OneBotGetFriendListResponse];
  set_friend_add_request: [OneBotFriendAddRequestHandleRequest, OneBotApiResponse<OneBotEmptyData>];
  set_group_add_request: [OneBotGroupAddRequestHandleRequest, OneBotApiResponse<OneBotEmptyData>];

  get_cookies: [OneBotGetCookiesRequest, OneBotGetCookiesResponse];
  get_csrf_token: [OneBotEmptyData, OneBotGetCsrfTokenResponse];
  get_credentials: [OneBotGetCredentialsRequest, OneBotGetCredentialsResponse];
  get_status: [OneBotEmptyData, OneBotGetStatusResponse];
  get_version_info: [OneBotEmptyData, OneBotGetVersionInfoResponse];
  set_restart: [OneBotSetRestartRequest, OneBotApiResponse<OneBotEmptyData>];
  clean_cache: [OneBotCleanCacheRequest, OneBotApiResponse<OneBotEmptyData>];
}

export type OneBotActionName = keyof OneBotActionMap;
export type OneBotActionRequest<TName extends OneBotActionName> = OneBotActionMap[TName][0];
export type OneBotActionResponse<TName extends OneBotActionName> = OneBotActionMap[TName][1];

