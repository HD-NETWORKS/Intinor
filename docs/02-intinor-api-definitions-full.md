# Intinor DirektAPIServer — Full Definitions (294 schemas, compact form)

Companion to `01-intinor-api-reference.md`. This is every single schema definition
in the unit's swagger.json, auto-derived into a compact, readable notation:

- `ref:X` = see definition X
- `field*` = required field
- `array<T>` = list of T
- `A + B` = schema A merged with schema B (`allOf` in the original OpenAPI spec)
- `{k:v, ...}` = inline object

This is exhaustive and mechanical — use it as ground truth for generating
TypeScript interfaces or a typed API client. For prose explanations of what
each resource group actually does, see the main reference doc instead.

---

```
access_control_settings :: {serial:string, ip:string, description*:string, key:string, active*:boolean}
aes67 :: {remote_sources:ref:aes67_remote_sources, ptp:ref:aes67_ptp_root, _links:array<ref:link>, _messages:array<ref:message>, sources:ref:aes67_sources, settings:ref:aes67_settings_response, sinks:ref:aes67_sinks}
aes67_ptp_root :: {status:ref:aes67_ptp_status, _messages:array<ref:message>, _links:array<ref:link>, settings:ref:aes67_ptp_settings_response}
aes67_ptp_settings :: {dscp*:integer, domain*:integer}
aes67_ptp_settings_constraints :: {dscp*:array<ref:description_integer_value>, mutable*:array<string>}
aes67_ptp_settings_request :: ref:aes67_ptp_settings + ref:common_request_metadata
aes67_ptp_settings_response :: ref:aes67_ptp_settings + ref:common_response_metadata + {_constraints:ref:aes67_ptp_settings_constraints}
aes67_ptp_status :: {status*:string, _links:array<ref:link>, gmid*:string, status_description*:string, jitter*:integer}
aes67_remote_source :: {domain*:string, sdp*:string, id*:string, device_address*:string, name*:string, rtp_address*:string, announcement_protocol*:string, rtp_port*:integer, last_seen*:integer, channels*:integer, announce_period*:integer}
aes67_remote_sources :: {_messages:array<ref:message>, remote_sources*:array<ref:aes67_remote_source>, _links:array<ref:link>}
aes67_settings :: {active*:boolean, audio*:{sample_rate*:integer, max_channels*:integer, tic_frame_size_at_1fs*:integer, playout_delay*:integer}, network*:{node_id*:string, mdns_enabled*:boolean, rtsp_port*:integer, sap_mcast_addr*:string, network_interface*:string, rtp_mcast_base*:string, sap_interval*:integer, rtp_port*:integer}}
aes67_settings_constraints :: {mutable*:array<string>, audio*:{playout_delay*:ref:description_integer_min_max, sample_rate*:array<ref:description_integer_value>, max_channels*:array<ref:description_integer_value>, tic_frame_size_at_1fs*:array<ref:description_integer_value>}, network*:{network_interface*:array<ref:description_value>}}
aes67_settings_request :: ref:aes67_settings + ref:common_request_metadata
aes67_settings_response :: ref:aes67_settings + ref:common_response_metadata + {_constraints:ref:aes67_settings_constraints}
aes67_sink_settings :: {channels*:integer, ignore_refclk_gmid*:boolean, first_channel*:integer, sdp_url:string, delay*:integer, id*:string, name*:string, sdp:string, use_sdp*:boolean}
aes67_sink_settings_constraints :: {first_channel*:array<ref:description_integer_value>, channels*:ref:description_integer_min_max, delay*:array<ref:description_integer_value>}
aes67_sink_status :: {id*:string, flags*:{muted*:boolean, rtp_payload_type_error*:boolean, rtp_seq_id_error*:boolean, receiving_rtp_packet*:boolean, rtp_sac_error*:boolean, rtp_ssrc_error*:boolean}, min_time*:integer}
aes67_sinks :: {status:ref:aes67_sinks_status, _messages:array<ref:message>, settings:ref:aes67_sinks_settings_response, _links:array<ref:link>}
aes67_sinks_settings :: {sinks*:array<ref:aes67_sink_settings>}
aes67_sinks_settings_request :: ref:aes67_sinks_settings + ref:common_request_metadata
aes67_sinks_settings_response :: ref:aes67_sinks_settings + ref:common_response_metadata + {_constraints:{sinks*:ref:aes67_sink_settings_constraints, mutable*:array<string>}}
aes67_sinks_status :: {_links:array<ref:link>, sinks*:array<ref:aes67_sink_status>}
aes67_source_settings :: {id*:string, payload_type*:integer, address*:string, first_channel*:integer, enabled*:boolean, name*:string, max_samples_per_packet*:integer, channels*:integer, refclk_ptp_traceable*:boolean, dscp*:integer, codec*:string, ttl*:integer}
aes67_source_settings_constraints :: {dscp*:array<ref:description_integer_value>, ttl*:ref:description_integer_min_max, codec*:array<ref:description_value>, max_samples_per_packet*:array<ref:description_integer_value>, channels*:ref:description_integer_min_max, first_channel*:array<ref:description_integer_value>, payload_type*:ref:description_integer_min_max}
aes67_sources :: {sources*:array<{sdp:string, _links:array<ref:link>, id*:string}>, _messages:array<ref:message>, settings:ref:aes67_sources_settings_response, _links:array<ref:link>}
aes67_sources_settings :: {sources*:array<ref:aes67_source_settings>}
aes67_sources_settings_request :: ref:aes67_sources_settings + ref:common_request_metadata
aes67_sources_settings_response :: ref:aes67_sources_settings + ref:common_response_metadata + {_constraints:{sources*:ref:aes67_source_settings_constraints, mutable*:array<string>}}
api_root_info :: {ftp_server:ref:ftp_server, video_inputs:ref:video_inputs_list, encoding:ref:encoding, multiviews:ref:multiviews_list, data_costs:ref:data_costs, api_version*:string, _links:array<ref:link>, system:ref:system_information, media_bank:ref:media_bank, ndi:ref:ndi, video_outputs:ref:video_outputs_list, test_picture:ref:test_picture, encoders:ref:encoders_list, network_interfaces:ref:network_interfaces_list, network_inputs:ref:network_inputs_list, aes67:ref:aes67, ftp_auto_uploader:ref:ftp_auto_uploader, recording:ref:recording, video_mixers:ref:video_mixers_list, sim_cards:ref:sim_cards_list_response, wifi:ref:wifi, storage:ref:storage, samba_server:ref:samba_server}
audio_format :: {sample_rate*:integer, bit_depth*:integer, channels*:integer}
audio_status :: {description:string, format*:ref:audio_format, language:string, codec:ref:codec_status}
available_firmware :: {version*:string, release:string, source*:string, datetime:string}
battery_status :: {current:number, seconds_to_full:number, charge:number, seconds_to_empty:number, voltage:number, temperature:number, average_current:number}
builtin_encoding_modes_constraints :: {audio*:{tracks*:{min*:integer, max*:integer}, downmix*:array<ref:description_value>}}
builtin_encoding_modes_settings :: {audio*:ref:builtin_encoding_modes_settings_audio}
builtin_encoding_modes_settings_audio :: {downmix:string, tracks*:integer}
codec_status :: {name*:string, configured_performance_mode:string, adaptive_bitrate_max:integer, level:string, adaptive_bitrate_min:integer, default_performance_mode:string, profile:string, bitrate:integer, bitrate_buffer:number, performance_mode:string, adaptive_bitrate*:boolean}
common_encoding_settings :: {builtin_encoding_modes*:ref:builtin_encoding_modes_settings, custom_encoding_modes*:array<ref:encoding_mode>, video_input*:ref:encoding_settings_video_input}
common_pipe_constraints :: {connectors*:array<ref:connector>, formats:array<ref:video_format_format_constraints>}
common_pipe_info :: {_links:array<ref:link>, name*:string, index*:integer, description*:string, active*:boolean, href*:string, type*:string}
common_pipe_settings :: {description*:string, active*:boolean}
common_pipe_settings_constraints :: {capabilities*:{deactivatable*:boolean}}
common_pipe_status :: {messages*:array<ref:message>, active*:boolean, description*:string, _links:array<ref:link>}
common_request_metadata :: {_version:string}
common_response_metadata :: {_version*:string, _messages:array<ref:message>, _links:array<ref:link>}
common_user_settings :: {role*:string, password:string, username*:string, permissions*:array<{role:string, resource*:string}>}
connector :: {name*:string}
cpu_status :: {usage*:number}
custom_encoding_modes_constraints :: {audio_codecs*:array<{samplerate*:array<{description*:string, value:integer}>, downmix*:array<ref:description_value>, bitrate*:{max*:integer, min*:integer}, value*:string, tracks*:{min*:integer, max*:integer}, description*:string}>, video_codecs*:array<{latency_quality_mode:array<{coded_picture_buffer*:{seconds:number, frames:integer}, value*:string, description*:string, encoding_latency*:{frames:integer, seconds:number}}>, value*:string, capabilities*:{scene_change_detection*:boolean}, chroma*:array<ref:description_value>, format*:array<ref:video_format_format_constraints>, gop*:{min*:integer, max*:integer}, description*:string, adaptive_bitrate:{bitrate_lower_factor*:number, bitrate_upper_factor*:number}, bitrate_buffer*:array<{description*:string, value*:number}>, bitrate*:{min*:integer, max*:integer}, level*:array<ref:description_value>, profile*:array<ref:description_value>}>}
data_cost_item :: {custom_id:string, href:string, value*:string, type*:string}
data_costs :: {settings:ref:data_costs_settings_response, _links:array<ref:link>}
data_costs_settings :: {adaptive_bitrate_max_cost*:string, _constraints:ref:data_costs_settings_constraints, costs*:array<ref:data_cost_item>}
data_costs_settings_constraints :: {costs*:array<ref:description_value>, adaptive_bitrate_max_cost*:array<string>, mutable*:array<string>}
data_costs_settings_request :: ref:common_request_metadata + ref:data_costs_settings
data_costs_settings_response :: ref:common_response_metadata + ref:data_costs_settings
description_documentation_value :: ref:description_value + {documentation*:string}
description_integer_min_max :: {min*:integer, max*:integer}
description_integer_value :: {value:integer, description*:string}
description_value :: {value:string, description*:string}
destination_status_basic :: ref:destination_status_common + {id*:string, bonding:ref:destination_status_bonding, packet_loss:number, fec:ref:destination_status_fec, udp_smoothing_buffer:number}
destination_status_bonding :: {paths*:array<{packet_late_history:number, estimated_capacity*:integer, network_interface*:string, packet_late:number, redundancy_bitrate:integer, messages*:array<ref:message>, estimate_is_max*:boolean, packet_loss_history:number, latency:number, bitrate*:integer, destination:string, viable:boolean, latency_history:number, packet_loss:number}>, destinations:array<string>, estimated_capacity*:integer, estimate_is_max*:boolean, failover_active:boolean, bitrate*:integer, destination:string}
destination_status_common :: {messages*:array<ref:message>, bitrate*:integer}
destination_status_fec :: {bitrate_overhead*:number, packet_loss:number}
destination_status_rtmp :: ref:destination_status_common + {id*:string}
destination_status_srt_client :: ref:destination_status_common + {packet_loss:number, address*:string}
destination_status_tcp_client :: ref:destination_status_common + {address*:string}
destinations_settings :: {rtmp:array<ref:destinations_settings_rtmp>, basic*:array<ref:destinations_settings_basic>, srt_on_request:ref:destinations_srt_on_request, advanced*:ref:destinations_settings_advanced, tcp_on_request*:ref:destinations_tcp_on_request}
destinations_settings_advanced :: {udp_bonding_delay:number, brt:{redundancy_profile*:string, buffer_profile*:string, selective_redundancy_profile*:string, custom_latency*:number, custom_end_to_end_delay*:number, latency_profile*:string, custom_redundancy*:number}, extra_delay:integer, fec_layout:{d*:integer, l*:integer}, udp_smoothing_buffer:number}
destinations_settings_basic :: {rist:{latency*:number, password:string, key_length:integer, profile*:string}, port*:integer, active*:boolean, network_interface:string, protocol*:string, extra_delay:integer, id*:string, failover:array<{port*:integer, description*:string, additional:array<ref:destinations_settings_basic_additional>, active*:boolean, address*:string}>, description*:string, srt:{latency*:number, rendezvous:boolean, password*:string, stream_id*:string, key_length*:integer}, additional:array<ref:destinations_settings_basic_additional>, address*:string}
destinations_settings_basic_additional :: {address*:string, active*:boolean, description*:string, port*:integer}
destinations_settings_constraints :: {tcp_on_request:{extra_delay:{max*:integer, min*:integer}}, capabilities*:{encryption*:boolean}, advanced:{udp_smoothing_buffer:{min*:number, max*:number, is_configurable*:boolean}, srt:{key_length*:array<{value*:integer, name*:string}>}, extra_delay:{minimum*:integer, maximum*:integer, max:integer, min:integer}, brt:{latency_profile*:array<{amount:number, value*:string, name*:string}>, redundancy_profile*:array<{amount:number, value*:string, name*:string}>, buffer_profile*:array<{value*:string, name*:string}>, selective_redundancy_profile*:array<{value*:string, name*:string}>}}, basic*:{rist:{profile:array<{name*:string, value*:string}>, key_length*:array<{name*:string, value*:integer}>}, extra_delay:{max*:integer, min*:integer}, network_interface*:array<ref:description_value>}, srt_on_request:{extra_delay:{max*:integer, min*:integer}, adapter:array<ref:description_value>}, rtmp:{audio_track_selection*:boolean, extra_delay:{max*:integer, min*:integer}}, protocol*:array<{value*:string, type*:string, description*:string}>}
destinations_settings_rtmp :: {description*:string, id*:string, user:string, active*:boolean, backup:{password:string, url*:string, stream*:string, user:string}, password:string, audio_track:integer, url*:string, stream*:string, extra_delay:integer}
destinations_srt_on_request :: {adapter:string, key_length:integer, latency:number, local_port*:integer, password:string, extra_delay:integer, active*:boolean, rtp_over_srt:boolean}
destinations_status :: {tcp_on_request*:{clients*:array<ref:destination_status_tcp_client>}, rtmp*:array<ref:destination_status_rtmp>, basic*:array<ref:destination_status_basic>, srt_on_request:{clients*:array<ref:destination_status_srt_client>}}
destinations_tcp_on_request :: {active*:boolean, extra_delay:integer, local_port*:integer}
directory :: {_constraints:ref:storage_tree_constraints, path*:string, subdirectories*:array<ref:subdirectory_info>, list_time*:string, _links:array<ref:link>, files*:array<ref:file_info>}
encoder :: ref:common_pipe_info + {_constraints:ref:common_pipe_constraints, settings:ref:encoder_settings_response, thumbnails:ref:pipe_thumbnails, status:ref:encoder_status}
encoder_settings :: ref:common_pipe_settings + {recording*:ref:pipe_recording_settings, encoding*:ref:pipe_encoding_settings, video_source*:ref:video_source_settings, access_control:array<ref:access_control_settings>, destinations*:ref:destinations_settings}
encoder_settings_constraints :: ref:common_pipe_settings_constraints + {encoding*:ref:pipe_encoding_settings_constraints, recording*:ref:pipe_recording_settings_constraints, destinations*:ref:destinations_settings_constraints, mutable*:array<string>, video_source*:ref:video_source_settings_constraints}
encoder_settings_request :: ref:encoder_settings + ref:common_request_metadata
encoder_settings_response :: ref:encoder_settings + ref:common_response_metadata + {_constraints:ref:encoder_settings_constraints}
encoder_status :: ref:common_pipe_status + {recording*:ref:recording_status, video_source*:ref:video_source_status, encoding*:ref:encoding_status, destinations*:ref:destinations_status}
encoders_list :: {encoders:array<ref:encoder>, _links:array<ref:link>}
encoding :: {encoding_modes:ref:encoding_modes_response, settings:ref:encoding_settings_response, _links:array<ref:link>}
encoding_mode :: {video*:ref:encoding_mode_video, audio*:ref:encoding_mode_audio, group:string, group_description:string, total_bitrate:integer, href:string, description*:string, id*:string}
encoding_mode_audio :: {downmix:string, bitrate*:integer, tracks*:integer, samplerate:integer, codec*:string}
encoding_mode_response :: ref:encoding_mode + ref:common_response_metadata
encoding_mode_video :: {latency_quality_mode:string, gop*:integer, scene_change_detection:boolean, performance_mode:string, codec*:string, chroma*:string, bitrate_buffer:number, format*:string, bitrate*:integer, level*:string, profile*:string}
encoding_modes_response :: {encoding_modes*:array<ref:encoding_mode>} + ref:common_response_metadata
encoding_settings :: ref:common_encoding_settings + {_version:string}
encoding_settings_constraints :: {video_input*:ref:video_input_constraints, mutable*:array<string>, builtin_encoding_modes*:ref:builtin_encoding_modes_constraints, custom_encoding_modes*:ref:custom_encoding_modes_constraints}
encoding_settings_response :: ref:common_encoding_settings + ref:common_response_metadata + {_constraints:ref:encoding_settings_constraints}
encoding_settings_video_input :: {sd_aspect_ratio:string}
encoding_status :: {sidedata:{scte35:{injected_packets:integer}}, audio*:array<ref:audio_status>, video:ref:video_status, total_bitrate*:integer}
file_info :: {download*:string, modified*:string, type:string, start:string, end:string, name*:string, new_sequence:boolean, href*:string, size*:integer}
firmware_status :: {datetime*:string, valid:boolean, version*:string}
ftp_auto_uploader :: {settings:ref:ftp_auto_uploader_settings_response, _links:array<ref:link>, status:ref:ftp_auto_uploader_status}
ftp_auto_uploader_settings :: {remote*:{address*:string, port*:integer, file_pattern:string, temporary_suffix:string, password*:string, username*:string, path*:string}, transfer_while_live:boolean, bitrate_limit:integer, active*:boolean, local*:{paths*:array<string>, suffixes*:array<string>}}
ftp_auto_uploader_settings_constraints :: {mutable*:array<string>}
ftp_auto_uploader_settings_request :: ref:ftp_auto_uploader_settings + ref:common_request_metadata
ftp_auto_uploader_settings_response :: ref:ftp_auto_uploader_settings + ref:common_response_metadata + {_constraints:ref:ftp_auto_uploader_settings_constraints}
ftp_auto_uploader_status :: {queue*:array<ref:ftp_auto_uploader_status_queue_item>, queue_size*:integer, current_speed*:integer, error_message:string, state*:string}
ftp_auto_uploader_status_queue_item :: {local_file*:string, uploaded*:integer, remote_path*:string, size*:integer}
ftp_server :: {settings:ref:ftp_server_settings_response, _links:array<ref:link>}
ftp_server_settings :: {users*:array<ref:ftp_server_user>, active*:boolean}
ftp_server_settings_request :: ref:ftp_server_settings + ref:common_request_metadata
ftp_server_settings_response :: ref:ftp_server_settings + ref:common_response_metadata
ftp_server_user :: {password*:string, username*:string}
layout_settings_constraints :: {number_of_inputs*:integer, description*:string, value*:string}
link :: {method*:string, href*:string, rel*:string}
media_bank :: {_constraints:ref:media_bank_constraints, _links:array<ref:link>, status:ref:media_bank_status}
media_bank_constraints :: {mutable*:array<string>}
media_bank_status :: {_links:array<ref:link>, used*:integer, size*:integer}
memory_status :: {total*:integer, available*:integer}
message :: {id:string, fields:array<string>, severity*:enum[notice|warning|error], message*:string, links:array<ref:link>}
multiview :: ref:common_pipe_info + {_constraints:ref:common_pipe_constraints, settings:ref:multiview_settings_response, thumbnails:ref:pipe_thumbnails, status:ref:multiview_status}
multiview_settings :: ref:common_pipe_settings + {video_sources*:array<ref:multiview_source_settings>, layout*:string, video_out*:ref:multiview_video_out_settings}
multiview_settings_constraints :: ref:common_pipe_settings_constraints + {video_out*:ref:multiview_video_out_settings_constraints, mutable*:array<string>, layout*:array<ref:layout_settings_constraints>, video_sources*:ref:video_source_source_settings_constraints}
multiview_settings_request :: ref:multiview_settings + ref:common_request_metadata
multiview_settings_response :: ref:multiview_settings + ref:common_response_metadata + {_constraints:ref:multiview_settings_constraints}
multiview_source_settings :: ref:video_source_source_settings + {index*:integer}
multiview_source_status :: ref:video_source_status + {index*:integer}
multiview_status :: ref:common_pipe_status + {video_sources*:array<ref:multiview_source_status>, video_out*:ref:video_out_status}
multiview_video_out_settings :: {ppm_overlay*:boolean, info_overlay*:string, format*:string, sd_aspect_ratio*:string, video_mixer_source:string}
multiview_video_out_settings_constraints :: {format*:array<ref:video_format_format_constraints>, info_overlay*:array<ref:description_value>, sd_aspect_ratio*:array<ref:description_value>}
multiviews_list :: {_links:array<ref:link>, multiviews:array<ref:multiview>}
ndi :: {streams:ref:ndi_streams, _links:array<ref:link>}
ndi_stream :: {sender*:string, stream*:string, value*:string}
ndi_streams :: {streams*:array<ref:ndi_stream>, _links:array<ref:link>}
netvideo_source_settings :: {rtsp_pull:{url*:string}, hls:{url:string}, ndi:{audio_gain*:number, source*:string}, srt_caller:{password*:string, latency*:number, adapter:string, stream_id*:string, port*:integer, rendezvous*:boolean, address*:string}, type:string, audio_select:array<{value*:string, target*:string}>, srt_listener:{adapter:string, latency*:number, rendezvous*:boolean, port*:integer, password*:string, address*:string}, rtmp_receive:{stream*:string}, rtmp_pull:{stream*:string, url*:string}}
netvideo_source_settings_constraints :: {advanced:{source_clock_reconstruction*:array<ref:description_integer_value>}, type*:array<{description*:string, value*:string}>, rtmp_receive:{rtmp_url_example*:string}, audio_select*:array<{description*:string, target*:string}>, network_interface:array<ref:description_value>}
netvideo_source_status :: {rtmp_receive:ref:netvideo_source_status_rtmp_receive, hls:ref:netvideo_source_status_hls, srt:ref:netvideo_source_status_srt}
netvideo_source_status_hls :: {detected_programs*:array<ref:netvideo_source_status_hls_detected_program>, selected_program:integer}
netvideo_source_status_hls_detected_program :: {bitrate:integer, audio*:array<{channels:integer, description:string, language:string}>, video:{width:integer, framerate:number, height:integer}}
netvideo_source_status_rtmp_receive :: {address:string, bitrate:integer}
netvideo_source_status_srt :: {latency:number, bitrate:integer, address:string, packet_loss:{before*:number, after*:number}}
network_input :: ref:common_pipe_info + {_constraints:ref:common_pipe_constraints, status:ref:network_input_status, settings:ref:network_input_settings_response, thumbnails:ref:pipe_thumbnails}
network_input_settings :: ref:common_pipe_settings + {network_sources*:ref:network_sources_settings, recording:ref:pipe_recording_settings, access_control*:array<ref:access_control_settings>, destinations:ref:destinations_settings}
network_input_settings_constraints :: ref:common_pipe_settings_constraints + {recording:ref:pipe_recording_settings_constraints, network_sources*:ref:network_sources_settings_constraints, destinations:ref:destinations_settings_constraints, mutable*:array<string>}
network_input_settings_request :: ref:network_input_settings + ref:common_request_metadata
network_input_settings_response :: ref:network_input_settings + ref:common_response_metadata + {_constraints:ref:network_input_settings_constraints}
network_input_status :: ref:common_pipe_status + {recording:ref:recording_status, network_source*:ref:network_source_status, destinations*:ref:destinations_status}
network_inputs_list :: {_links:array<ref:link>, network_inputs:array<ref:network_input>}
network_interface :: {href*:string, _links:array<ref:link>, name*:string, index*:integer, type*:string}
network_interface_response :: ref:network_interface + {settings:ref:network_interface_settings + {_constraints:ref:network_interface_settings_constraints}, status:ref:network_interface_status}
network_interface_settings :: {mode*:string, netmask:string, address:string, dns:string, gateway:string, multicast_enabled*:boolean}
network_interface_settings_constraints :: {multicast_possible*:boolean, mode*:array<ref:description_value>, mutable*:array<string>, network_interface*:string}
network_interface_status :: {testing_internet_access:boolean, ethernet:{link:integer, duplex:string, address*:string}, tx_bitrate*:integer, internet_access*:boolean, primary_interface*:boolean, cellular_modem:{sim:{iccid:string, sim_card:string, status_description:string, provider:string}, service:{type*:string, simple_signal_strength*:integer, status_description*:string, signal_rssi:number, provider:string}, connected*:boolean, status_description*:string, modem:{vendor:string, model:string, imei:string, revision:string}, helptext_description:string, error_description:string}, rx_bitrate*:integer, kasat_modem:{symbol_rate:integer, rx_snr:number}, ip:{address*:string, netmask*:string}}
network_interfaces_list :: {status:ref:network_interfaces_status, network_interfaces*:array<ref:network_interface>, settings:ref:network_interfaces_settings_response, _links:array<ref:link>}
network_interfaces_settings :: {settings*:array<ref:network_interface_settings>}
network_interfaces_settings_request :: ref:network_interfaces_settings + ref:common_request_metadata
network_interfaces_settings_response :: ref:network_interfaces_settings + ref:common_response_metadata + {_constraints:array<ref:network_interface_settings_constraints>}
network_interfaces_status :: {_links:array<ref:link>, status*:array<ref:network_interface_status>}
network_source_status :: {source_type:string, bitrate:integer, encrypted*:boolean, rtp:ref:network_source_status_rtp, packet_loss:number, fec:ref:network_source_status_fec, rist:{profile:integer}, programs*:array<ref:network_source_status_program>, sender:ref:network_source_status_sender, bonding:ref:network_source_status_bonding, srt:{}, address:string}
network_source_status_bonding :: {protocol:string, paths*:array<{receive_differential:number, messages*:array<ref:message>, packet_loss:number, receive_time:number, packet_late:number, address*:string, network_interface:string, id:string}>, buffer*:number}
network_source_status_fec :: {buffer*:number, packet_loss*:number}
network_source_status_program :: {end_to_end_delay:{delay:number, target:number}, number:integer, audio*:array<ref:audio_status>, messages*:array<ref:message>, thumbnail:string, video:ref:video_status, id*:string, name:string, buffers*:ref:network_source_status_program_buffer}
network_source_status_program_buffer :: {decoder*:number, target*:number, reception*:number}
network_source_status_rtp :: {buffer:number}
network_source_status_sender :: {serial*:string, verified*:boolean}
network_sources_advanced :: {tcp_receive_buffer*:number, decoder_buffer:number}
network_sources_rtmp :: {active*:boolean, url*:string, stream*:string}
network_sources_settings :: {rtmp:ref:network_sources_rtmp, tcp_receive*:ref:network_sources_tcp_receive, encryption:boolean, tcp_request*:ref:network_sources_tcp_request, advanced*:ref:network_sources_advanced, srt_caller:ref:network_sources_srt_caller, udp_unicast*:ref:network_sources_udp_unicast, udp_multicast*:ref:network_sources_udp_multicast}
network_sources_settings_constraints :: {udp_unicast*:{capabilities:{protocols*:array<ref:description_value>}, network_interface*:array<ref:description_value>}, udp_multicast*:{network_interface*:array<ref:description_value>}, capabilities*:{encryption*:boolean}, advanced:{tcp_receive_buffer*:{min*:number, max*:number}, decoder_buffer*:{max*:number, min*:number}}}
network_sources_srt_caller :: {adapter:string, stream_id:string, password:string, latency:number, active*:boolean, address*:string, port*:integer, rendezvous:boolean}
network_sources_tcp_receive :: {port*:integer, active*:boolean}
network_sources_tcp_request :: {port*:integer, active*:boolean, address*:string}
network_sources_udp_multicast :: {port*:integer, network_interface:string, address*:string, active*:boolean}
network_sources_udp_unicast :: {network_interface*:string, active*:boolean, srt:{latency*:number, password*:string}, port*:integer, rist:{latency*:number, password*:string}}
pip_zoom_settings_constraints :: {max*:integer, min*:integer}
pipe_encoding_settings :: {encoding_mode*:string, adaptive_bitrate:boolean}
pipe_encoding_settings_constraints :: {capabilities*:{adaptive_bitrate*:boolean}, encoding_mode*:array<{group*:string, total_bitrate*:integer, id*:string, value*:string, group_description*:string, description*:string}>, adaptive_bitrate:{audio_bitrate_upper_factor*:number, video_bitrate_upper_factor*:number, audio_bitrate_lower_factor*:number, video_bitrate_lower_factor*:number}}
pipe_recording_settings :: {mpegts:{max_file_size*:integer, path*:string, active*:boolean}, flv:{active*:boolean, max_file_size*:integer, path*:string}}
pipe_recording_settings_constraints :: {capabilities*:{separate_controls*:boolean}, file_formats*:array<{suffix*:string, value*:string, max_file_size:integer, description*:string}>}
pipe_thumbnail :: {href:string, _links:array<ref:link>, id*:string}
pipe_thumbnails :: {thumbnails*:array<ref:pipe_thumbnail>, _links:array<ref:link>}
profile_brief :: {index*:integer, description*:string, _links:array<ref:link>, settings:ref:profile_settings_response, href*:string}
profile_request :: {settings*:ref:profile_settings}
profile_settings :: {video_outputs_settings*:array<ref:video_output_settings_request>, network_inputs_settings*:array<ref:network_input_settings_request>, encoders_settings*:array<ref:encoder_settings_request>, network_interfaces_settings*:ref:network_interfaces_settings_request, multiviews_settings*:array<ref:multiview_settings_request>, video_mixers_settings*:array<ref:video_mixer_settings_request>, description*:string, encoding_settings*:ref:encoding_settings, video_inputs_settings*:array<ref:video_input_settings_request>, _version:string}
profile_settings_response :: {video_outputs_settings*:array<ref:video_output_settings_response>, encoders_settings*:array<ref:encoder_settings_response>, video_mixers_settings*:array<ref:video_mixer_settings_response>, multiviews_settings*:array<ref:multiview_settings_response>, network_interfaces_settings*:ref:network_interfaces_settings_response, _messages:array<ref:message>, encoding_settings*:ref:encoding_settings_response, video_inputs_settings*:array<ref:video_input_settings_response>, network_inputs_settings*:array<ref:network_input_settings_response>, description*:string, _links:array<ref:link>, _version:string}
recording :: {settings:ref:recording_settings_response, _links:array<ref:link>}
recording_settings :: {active*:boolean, _constraints:ref:recording_settings_constraints}
recording_settings_constraints :: {mutable*:array<string>, capabilities*:{separate_controls*:boolean}}
recording_settings_request :: ref:recording_settings + ref:common_request_metadata
recording_settings_response :: ref:recording_settings + ref:common_response_metadata
recording_status :: {flv:ref:recording_status_common, mpegts:ref:recording_status_common}
recording_status_common :: {status*:string, messages*:array<ref:message>, duration*:integer}
remote_management_status :: {status_description*:string, network_interface:string, address:string, via_http*:boolean, connected*:boolean}
samba_server :: {_links:array<ref:link>, settings:ref:samba_server_settings_response}
samba_server_settings :: {network_interfaces*:array<{active*:boolean, network_interface*:string}>, guest_writable*:boolean}
samba_server_settings_constraints :: {network_interface*:array<ref:description_value>, mutable*:array<string>}
samba_server_settings_request :: ref:samba_server_settings + ref:common_request_metadata
samba_server_settings_response :: ref:samba_server_settings + ref:common_response_metadata + {_constraints:ref:samba_server_settings_constraints}
sim_card :: {href*:string, iccid*:string, _links:array<ref:link>}
sim_card_settings :: {apn_username:string, iccid*:string, puk:string, active*:boolean, apn:string, force_4g*:boolean, apn_auth_method:string, description:string, apn_password:string, roaming:boolean, sim_card:string, pin:string}
sim_card_settings_constraints :: {sim_card:string, apn_auth_method*:array<ref:description_value>, mutable*:array<string>}
sim_cards_list_response :: {_links:array<ref:link>, settings:ref:sim_cards_settings_response, sim_cards*:array<ref:sim_card>}
sim_cards_settings_list :: {settings*:array<ref:sim_card_settings>}
sim_cards_settings_request :: ref:sim_cards_settings_list + ref:common_request_metadata
sim_cards_settings_response :: ref:sim_cards_settings_list + ref:common_response_metadata + {_constraints:array<ref:sim_card_settings_constraints>}
stm_error :: {message*:string, title*:string, status*:integer, exception:string}
stm_success :: {message*:string, title*:string, status*:integer}
storage :: {_constraints:ref:storage_constraints, _links:array<ref:link>, status:ref:storage_status}
storage_constraints :: {mutable*:array<string>, capabilities*:{raid*:boolean}, file_systems*:array<{value*:string, description*:string, file_size_limit:integer}>}
storage_status :: {_links:array<ref:link>, format_in_progress:boolean, model:string, vendor:string, file_system:string, size:integer, used:integer, raid:{disks*:array<{vendor:string, model:string, status*:string, serial:string, size:integer}>, status*:string, rebuild_progress:integer, size:integer}, removable*:boolean, present*:boolean, busy:boolean}
storage_tree_constraints :: {capabilities*:{file_access*:boolean}, mutable*:array<string>, filter*:array<ref:description_value>}
subdirectory_info :: {href*:string, name*:string}
system_constraints :: {capabilities*:{encryption*:boolean}, mutable*:array<string>}
system_information :: {product_type*:string, status:ref:system_status, firmware*:string, _constraints:ref:system_constraints, description*:string, model_name*:string, _links:array<ref:link>, access_key*:string, serial*:string, messages:array<ref:message>, language*:string, oem*:string, full_model_name*:string, product_image_version:string}
system_status :: {upgrade_media_present*:boolean, profile:{href*:string, name*:string}, firmware*:{default*:ref:firmware_status, recovery:ref:firmware_status, upgrade_progress_description:string, running*:ref:firmware_status}, memory:ref:memory_status, battery:ref:battery_status, upgrade_server*:ref:upgrade_server_info, remote_management:ref:remote_management_status, datetime*:string, talkback:ref:talkback_status, cpu*:ref:cpu_status}
talkback_status :: {status_description*:string, network_interface:string, via_http*:boolean, audio_outputs:integer, connected*:boolean, audio_inputs:integer, audio_interface_description:string}
test_picture :: {_links:array<ref:link>, settings:ref:test_picture_settings_response}
test_picture_settings :: {active*:boolean, audio*:string, background*:string, text_overlay*:string, animation_overlay*:string}
test_picture_settings_constraints :: {mutable*:array<string>, background*:array<ref:description_documentation_value>, audio*:array<ref:description_documentation_value>, layout_codes*:array<ref:description_documentation_value>, default_text_overlay*:string, animation_overlay*:array<ref:description_documentation_value>}
test_picture_settings_request :: ref:test_picture_settings + ref:common_request_metadata
test_picture_settings_response :: ref:test_picture_settings + ref:common_response_metadata + {_constraints:ref:test_picture_settings_constraints}
unauthorized :: ref:stm_error
upgrade_server_info :: {address*:string, port*:integer}
user :: {username*:string, _links:array<ref:link>, settings:ref:user_settings, href*:string}
user_list :: {_links:array<ref:link>, users*:array<ref:user>}
user_list_constraints :: {_constraints:array<ref:user_settings_constraints>}
user_list_response :: ref:user_list + ref:user_list_constraints
user_request :: {settings*:ref:user_settings}
user_response :: ref:user + {_messages:array<ref:message>}
user_session :: {username*:string, _links:array<ref:link>, user*:string, href*:string, session_id*:string}
user_settings :: ref:common_user_settings + {_version:string}
user_settings_constraints :: {mutable*:array<string>, role*:array<ref:description_documentation_value>, permissions*:array<{resource*:string, role*:array<ref:description_documentation_value>, description*:string}>, username:string}
user_settings_response :: ref:common_user_settings + ref:common_response_metadata + {_constraints:ref:user_settings_constraints}
validation_error :: ref:stm_error + {errors:array<ref:message>}
video_format :: {display_aspect*:string, pixel_aspect*:string, height*:integer, forced_aspect*:boolean, framerate*:number, interlaced*:boolean, width*:integer, top_field_first*:boolean, chroma_subsampling*:string}
video_format_format_constraints :: {framerate:number, resolution:string, description*:string, value:string}
video_in_status :: {audio*:array<ref:audio_status>, video:ref:video_status, available*:boolean}
video_input :: ref:common_pipe_info + {_constraints:ref:common_pipe_constraints, status:ref:video_input_status, settings:ref:video_input_settings_response, thumbnails:ref:pipe_thumbnails}
video_input_constraints :: {sd_aspect_ratio*:array<ref:description_value>}
video_input_settings :: ref:common_pipe_settings + {netvideo_source:ref:netvideo_source_settings}
video_input_settings_constraints :: ref:common_pipe_settings_constraints + {netvideo_source:ref:netvideo_source_settings_constraints, mutable*:array<string>}
video_input_settings_request :: ref:video_input_settings + ref:common_request_metadata
video_input_settings_response :: ref:video_input_settings + ref:common_response_metadata + {_constraints:ref:video_input_settings_constraints}
video_input_status :: ref:common_pipe_status + {netvideo_source:ref:netvideo_source_status, video_in*:ref:video_in_status}
video_inputs_list :: {video_inputs:array<ref:video_input>, _links:array<ref:link>}
video_mixer :: ref:common_pipe_info + {thumbnails:ref:pipe_thumbnails, settings:ref:video_mixer_settings_response, status:ref:video_mixer_status, _constraints:ref:common_pipe_constraints}
video_mixer_audio_settings :: {muted*:boolean, input*:ref:video_source_source_settings}
video_mixer_audio_settings_constraints :: {input*:{source:array<ref:description_documentation_value>}}
video_mixer_layer_layout_settings :: {zoom*:number, y*:number, x*:number}
video_mixer_layer_layout_settings_constraints :: {zoom*:{max*:number, min*:number}, x*:{max*:number, min*:number}, y*:{min*:number, max*:number}}
video_mixer_layer_settings :: {layout*:ref:video_mixer_layer_layout_settings, input*:ref:video_source_source_settings}
video_mixer_layout_profile_layer_settings :: {layout*:ref:video_mixer_layer_layout_settings}
video_mixer_layout_profiles_settings :: {layers*:array<ref:video_mixer_layout_profile_layer_settings>}
video_mixer_layout_profiles_settings_constraints :: {layers*:{array_size:{min:integer, max:integer}, layout:ref:video_mixer_layer_layout_settings_constraints}}
video_mixer_out_settings :: {pip*:{zoom*:integer}, format:string, sd_aspect_ratio*:string}
video_mixer_output_settings :: {overlay:ref:video_mixer_overlay_settings, background:string, layers*:array<ref:video_mixer_layer_settings>}
video_mixer_output_settings_constraints :: {layers*:{array_size:{min:integer, max:integer}, layout:ref:video_mixer_layer_layout_settings_constraints, input:ref:video_source_source_settings_constraints}}
video_mixer_output_status :: {layers*:array<{input*:ref:video_source_status}>}
video_mixer_overlay_settings :: {input*:ref:video_source_source_settings}
video_mixer_pipe_settings :: {preview:ref:video_mixer_output_settings, layout_profiles:array<ref:video_mixer_layout_profiles_settings>, source_profiles:array<ref:video_mixer_source_profile_settings>, video_sources*:array<ref:video_source_source_settings>, video_out*:ref:video_mixer_out_settings, audio:ref:video_mixer_audio_settings, program:ref:video_mixer_output_settings}
video_mixer_pipe_settings_constraints :: {program:ref:video_mixer_output_settings_constraints, audio:ref:video_mixer_audio_settings_constraints, video_out*:ref:videomixer_video_out_settings_constraints, mutable*:array<string>, layout_profiles:ref:video_mixer_layout_profiles_settings_constraints, video_sources*:ref:video_source_source_settings_constraints, preview:ref:video_mixer_output_settings_constraints}
video_mixer_settings :: ref:common_pipe_settings + ref:video_mixer_pipe_settings
video_mixer_settings_constraints :: ref:common_pipe_settings_constraints + ref:video_mixer_pipe_settings_constraints
video_mixer_settings_request :: ref:video_mixer_settings + ref:common_request_metadata
video_mixer_settings_response :: ref:video_mixer_settings + ref:common_response_metadata + {_constraints:ref:video_mixer_settings_constraints}
video_mixer_source_profile_settings :: {input:ref:video_source_source_settings}
video_mixer_status :: ref:common_pipe_status + {video_out*:ref:video_out_status, program:ref:video_mixer_output_status, video_source_pip:ref:video_source_status, video_sources*:array<ref:video_source_status>, preview:ref:video_mixer_output_status}
video_mixers_list :: {video_mixers:array<ref:video_mixer>, _links:array<ref:link>}
video_out_settings :: {format:string, ppm_overlay:boolean}
video_out_settings_constraints :: {capabilities*:{ppm_overlay*:boolean}, format*:array<ref:video_format_format_constraints>}
video_out_status :: {audio*:array<ref:audio_status>, video:ref:video_status}
video_output :: ref:common_pipe_info + {_constraints:ref:common_pipe_constraints, thumbnails:ref:pipe_thumbnails, settings:ref:video_output_settings_response, status:ref:video_output_status}
video_output_out_status :: ref:video_out_status + {connector_name:string}
video_output_settings :: ref:common_pipe_settings + {video_source*:ref:video_source_settings, video_out*:ref:video_out_settings}
video_output_settings_constraints :: ref:common_pipe_settings_constraints + {video_source*:ref:video_source_settings_constraints, mutable*:array<string>, video_out*:ref:video_out_settings_constraints}
video_output_settings_request :: ref:video_output_settings + ref:common_request_metadata
video_output_settings_response :: ref:video_output_settings + ref:common_response_metadata + {_constraints:ref:video_output_settings_constraints}
video_output_status :: ref:common_pipe_status + {video_source*:ref:video_source_status, video_out*:ref:video_output_out_status}
video_outputs_list :: {_links:array<ref:link>, video_outputs:array<ref:video_output>}
video_source_constraint :: {name*:string, programs:array<ref:description_value>, value:string, description*:string, multiprogram*:boolean}
video_source_settings :: ref:video_source_source_settings + {fallback*:string}
video_source_settings_constraints :: ref:video_source_source_settings_constraints + {fallback*:array<ref:description_value>}
video_source_source_settings :: {program_id:integer, source*:string}
video_source_source_settings_constraints :: {source*:array<ref:video_source_constraint>}
video_source_status :: {available*:boolean, fallback:boolean, fallback_type:string, program_id:integer, source*:string, video:ref:video_status, thumbnail:string, fallback_description:string, audio*:array<ref:audio_status>}
video_status :: {codec:ref:codec_status, format*:ref:video_format}
videomixer_video_out_settings_constraints :: {format*:array<ref:video_format_format_constraints>, pip*:{zoom*:ref:pip_zoom_settings_constraints}, sd_aspect_ratio*:array<ref:description_value>}
wifi :: {_links:array<ref:link>, settings:ref:wifi_settings_response, access_point:ref:wifi_access_point, status:ref:wifi_status}
wifi_access_point :: {network_interface*:string, settings:ref:wifi_access_point_settings_response, _links:array<ref:link>, status:ref:wifi_access_point_status}
wifi_access_point_settings :: {ssid:string, password*:string}
wifi_access_point_settings_constraints :: {mutable*:array<string>}
wifi_access_point_settings_request :: ref:wifi_access_point_settings + ref:common_request_metadata
wifi_access_point_settings_response :: ref:wifi_access_point_settings + ref:common_response_metadata + {_constraints:ref:wifi_access_point_settings_constraints}
wifi_access_point_status :: {_links:array<ref:link>, clients*:array<{address*:string}>}
wifi_settings :: {networks*:array<{password:string, security:string, ssid*:string, active*:boolean}>}
wifi_settings_constraints :: {security:array<ref:description_value>, mutable*:array<string>}
wifi_settings_request :: ref:wifi_settings + ref:common_request_metadata
wifi_settings_response :: ref:wifi_settings + ref:common_response_metadata + {_constraints:ref:wifi_settings_constraints}
wifi_status :: {bssid:string, networks*:array<{bssid*:string, security:string, ssid*:string, level*:integer, frequency*:integer}>, status*:string, ssid:string, security:string, _links:array<ref:link>, connected*:boolean, last_error:{bssid:string, error_description:string}}
```
